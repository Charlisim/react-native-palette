package expo.modules.palettesampler

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Rect
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.View
import android.view.ViewGroup
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.floor

// Spike code.

// The message repeats the code. The JS side does not depend on the `code` field format.
private fun paletteError(code: String, message: String, cause: Throwable? = null) =
  CodedException(code, "[$code] $message", cause)

private const val UNRESOLVED_VIEW =
  "A view reference does not resolve to a native view. Set collapsable={false} on the captureRoot and on the foreground."

private const val DIMEZIS_BLUR_VIEW = "eightbitlab.com.blurview.BlurView"

class PaletteSamplerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PaletteSampler")

    // One UI-thread message. No frame is drawn between the exclusion and the restoration.
    AsyncFunction("sampleAsync") { rootTag: Int, foregroundTag: Int, x: Double, y: Double, mode: String ->
      sample(rootTag, foregroundTag, x, y, mode)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("inspectAsync") { tag: Int ->
      val view = resolve(tag)
        ?: throw paletteError("INVALID_VIEW_RELATIONSHIP", UNRESOLVED_VIEW)
      snapshot(view)
    }.runOnQueue(Queues.MAIN)

    // Diagnostic. Rectangle of the view in screen pixels, for a comparison with a screenshot.
    AsyncFunction("locateAsync") { tag: Int ->
      val view = resolve(tag) ?: throw paletteError("INVALID_VIEW_RELATIONSHIP", UNRESOLVED_VIEW)
      val location = IntArray(2)
      view.getLocationOnScreen(location)
      val density = view.resources.displayMetrics.density.toDouble()
      mapOf(
        "x" to location[0] / density,
        "y" to location[1] / density,
        "width" to view.width / density,
        "height" to view.height / density,
        "scale" to density
      )
    }.runOnQueue(Queues.MAIN)

    // EXPERIMENTAL. Reads one pixel of the last composited window frame. The foreground is not excluded.
    AsyncFunction("pixelCopyAsync") { rootTag: Int, foregroundTag: Int, x: Double, y: Double, promise: Promise ->
      val started = System.nanoTime()
      val root = resolve(rootTag)
      val foreground = resolve(foregroundTag)
      val window = appContext.currentActivity?.window
      if (root == null || foreground == null || window == null || Build.VERSION.SDK_INT < 26) {
        promise.reject(paletteError("CAPTURE_FAILED", "PixelCopy is not available."))
        return@AsyncFunction
      }
      val density = root.resources.displayMetrics.density
      val point = try {
        mapPoint(root, foreground, x, y)
      } catch (error: CodedException) {
        promise.reject(error)
        return@AsyncFunction
      }
      val pixelX = floor(point[0].toDouble()).toInt()
      val pixelY = floor(point[1].toDouble()).toInt()
      val location = IntArray(2)
      root.getLocationInWindow(location)
      val left = location[0] + pixelX
      val top = location[1] + pixelY
      val bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
      PixelCopy.request(window, Rect(left, top, left + 1, top + 1), bitmap, { result ->
        if (result == PixelCopy.SUCCESS) {
          val argb = bitmap.getPixel(0, 0)
          bitmap.recycle()
          promise.resolve(
            mapOf(
              "r" to Color.red(argb) / 255.0,
              "g" to Color.green(argb) / 255.0,
              "b" to Color.blue(argb) / 255.0,
              "a" to Color.alpha(argb) / 255.0,
              "captureX" to point[0].toDouble() / density,
              "captureY" to point[1].toDouble() / density,
              "pixelX" to pixelX.toDouble(),
              "pixelY" to pixelY.toDouble(),
              "scale" to density.toDouble(),
              "exclusion" to "none (PixelCopy)",
              "effects" to emptyList<Any>(),
              "nativeMs" to (System.nanoTime() - started) / 1e6
            )
          )
        } else {
          bitmap.recycle()
          promise.reject(paletteError("CAPTURE_FAILED", "PixelCopy failed with the result $result."))
        }
      }, Handler(Looper.getMainLooper()))
    }.runOnQueue(Queues.MAIN)
  }

  private var filterTagId: Int? = null

  /** Name of the effect that a software draw cannot render, or null. */
  private fun effectName(view: View): String? {
    val id = filterTagId ?: view.resources.getIdentifier("filter", "id", view.context.packageName).also { filterTagId = it }
    if (id != 0 && view.getTag(id) != null) {
      return "React Native filter style (RenderEffect)"
    }
    var type: Class<*>? = view.javaClass
    while (type != null && type != View::class.java) {
      if (type.name == DIMEZIS_BLUR_VIEW) {
        // A BlurView that is not set up has a no-op controller. It draws no blur.
        val controller = try {
          type.getDeclaredField("blurController").apply { isAccessible = true }.get(view)?.javaClass?.simpleName
        } catch (_: Throwable) {
          "unknown controller"
        }
        return if (controller == "NoOpController") null else "$DIMEZIS_BLUR_VIEW ($controller)"
      }
      type = type.superclass
    }
    return null
  }

  /** Lists the effect views in the capture root. The excluded foreground subtree is not visited. */
  private fun collectEffects(view: View, foreground: View, x: Float, y: Float, hits: MutableList<Map<String, Any?>>) {
    if (view === foreground || view.visibility != View.VISIBLE || view.alpha == 0f) {
      return
    }
    effectName(view)?.let { name ->
      hits.add(
        mapOf(
          "name" to name,
          "size" to listOf(view.width, view.height),
          "localPoint" to listOf(x.toDouble(), y.toDouble()),
          "containsPoint" to (x >= 0 && y >= 0 && x < view.width && y < view.height)
        )
      )
    }
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        val child = view.getChildAt(index) ?: continue
        val local = floatArrayOf(x + view.scrollX - child.left, y + view.scrollY - child.top)
        val matrix = child.matrix
        if (!matrix.isIdentity) {
          val inverse = Matrix()
          if (!matrix.invert(inverse)) continue
          inverse.mapPoints(local)
        }
        collectEffects(child, foreground, local[0], local[1], hits)
      }
    }
  }

  /** Maps the foreground-local point to the capture root, in physical pixels. */
  private fun mapPoint(root: View, foreground: View, x: Double, y: Double): FloatArray {
    val density = root.resources.displayMetrics.density
    val point = floatArrayOf((x * density).toFloat(), (y * density).toFloat())
    var current: View = foreground
    while (current !== root) {
      val matrix = current.matrix
      if (!matrix.isIdentity) {
        if (!matrix.isAffine) {
          throw paletteError("UNSUPPORTED_CONTENT", "A perspective transform is between the foreground and the capture root.")
        }
        matrix.mapPoints(point)
      }
      point[0] += current.left
      point[1] += current.top
      val parent = current.parent as? View
        ?: throw paletteError("INVALID_VIEW_RELATIONSHIP", "The foreground is not a descendant of the capture root.")
      point[0] -= parent.scrollX
      point[1] -= parent.scrollY
      current = parent
    }
    return point
  }

  private fun resolve(tag: Int): View? =
    try {
      appContext.findView<View>(tag)
    } catch (_: Throwable) {
      null
    }

  private fun snapshot(view: View): Map<String, Any?> = mapOf(
    "visibility" to view.visibility,
    "alpha" to view.alpha.toDouble(),
    "transitionAlpha" to (if (Build.VERSION.SDK_INT >= 29) view.transitionAlpha.toDouble() else 1.0),
    "frame" to listOf(view.left, view.top, view.right, view.bottom),
    "translation" to listOf(view.translationX.toDouble(), view.translationY.toDouble()),
    "scale" to listOf(view.scaleX.toDouble(), view.scaleY.toDouble()),
    "rotation" to view.rotation.toDouble(),
    "enabled" to view.isEnabled,
    "clickable" to view.isClickable,
    "importantForAccessibility" to view.importantForAccessibility,
    "hasFocus" to view.hasFocus(),
    "childIndex" to ((view.parent as? android.view.ViewGroup)?.indexOfChild(view) ?: -1),
    "attached" to view.isAttachedToWindow
  )

  private fun sample(rootTag: Int, foregroundTag: Int, x: Double, y: Double, mode: String): Map<String, Any?> {
    val started = System.nanoTime()
    if (!x.isFinite() || !y.isFinite()) {
      throw paletteError("INVALID_POINT", "The point must contain finite numbers.")
    }
    val root = resolve(rootTag)
    val foreground = resolve(foregroundTag)
    if (root == null || foreground == null) {
      throw paletteError("INVALID_VIEW_RELATIONSHIP", UNRESOLVED_VIEW)
    }
    if (foreground === root || !root.isAttachedToWindow || !foreground.isAttachedToWindow) {
      throw paletteError("INVALID_VIEW_RELATIONSHIP", "The foreground is not an attached descendant of the capture root.")
    }

    val density = root.resources.displayMetrics.density
    val point = mapPoint(root, foreground, x, y)

    if (root.width <= 0 || root.height <= 0 || foreground.width <= 0 || foreground.height <= 0 || !root.isLaidOut) {
      throw paletteError("NOT_READY", "The capture root or the foreground has a zero size.")
    }
    if (!point[0].isFinite() || !point[1].isFinite() ||
      point[0] < 0 || point[1] < 0 || point[0] >= root.width || point[1] >= root.height
    ) {
      throw paletteError("INVALID_POINT", "The mapped point (${point[0]}, ${point[1]}) px is outside the capture root.")
    }

    // Rounding rule: the physical pixel that contains the logical point.
    val pixelX = floor(point[0].toDouble()).toInt()
    val pixelY = floor(point[1].toDouble()).toInt()

    // A software draw does not render a RenderEffect or a hardware blur. Reject the sample.
    val effects = mutableListOf<Map<String, Any?>>()
    collectEffects(root, foreground, point[0] + root.scrollX, point[1] + root.scrollY, effects)
    if (mode != "skipEffectCheck") {
      effects.firstOrNull { it["containsPoint"] == true }?.let { hit ->
        throw paletteError(
          "UNSUPPORTED_CONTENT",
          "An effect view (${hit["name"]}) covers the sample point. The capture cannot render this effect."
        )
      }
    }

    val useTransitionAlpha = mode != "visibility" && Build.VERSION.SDK_INT >= 29
    val exclusion = when {
      mode == "skipExclusion" -> "none"
      useTransitionAlpha -> "transitionAlpha"
      else -> "visibility"
    }
    val before = snapshot(foreground)
    var during: Map<String, Any?> = emptyMap()
    val previousVisibility = foreground.visibility
    val previousTransitionAlpha = if (Build.VERSION.SDK_INT >= 29) foreground.transitionAlpha else 1f

    val bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
    val argb: Int
    try {
      val canvas = Canvas(bitmap)
      canvas.translate((-pixelX - root.scrollX).toFloat(), (-pixelY - root.scrollY).toFloat())
      try {
        if (exclusion == "transitionAlpha" && Build.VERSION.SDK_INT >= 29) {
          foreground.transitionAlpha = 0f
        } else if (exclusion == "visibility") {
          foreground.visibility = View.INVISIBLE
        }
        during = snapshot(foreground)
        if (mode == "failAfterHide") {
          throw paletteError("CAPTURE_FAILED", "Forced failure after the exclusion (debug mode).")
        }
        root.draw(canvas)
      } catch (error: CodedException) {
        throw error
      } catch (error: Throwable) {
        // A software canvas cannot draw a hardware bitmap. Do not return a black sample.
        if (error.message?.contains("hardware bitmap", ignoreCase = true) == true) {
          throw paletteError("UNSUPPORTED_CONTENT", "The capture root contains a hardware bitmap.", error)
        }
        throw paletteError("CAPTURE_FAILED", "The software draw failed: ${error.message}", error)
      } finally {
        if (exclusion == "transitionAlpha" && Build.VERSION.SDK_INT >= 29) {
          foreground.transitionAlpha = previousTransitionAlpha
        } else if (exclusion == "visibility") {
          foreground.visibility = previousVisibility
        }
      }
      // `getPixel` returns straight alpha in sRGB.
      argb = bitmap.getPixel(0, 0)
    } finally {
      bitmap.recycle()
    }

    val after = snapshot(foreground)
    return mapOf(
      "r" to Color.red(argb) / 255.0,
      "g" to Color.green(argb) / 255.0,
      "b" to Color.blue(argb) / 255.0,
      "a" to Color.alpha(argb) / 255.0,
      "captureX" to point[0].toDouble() / density,
      "captureY" to point[1].toDouble() / density,
      "pixelX" to pixelX.toDouble(),
      "pixelY" to pixelY.toDouble(),
      "scale" to density.toDouble(),
      "exclusion" to exclusion,
      "effects" to effects,
      "before" to before,
      "during" to during,
      "after" to after,
      "nativeMs" to (System.nanoTime() - started) / 1e6
    )
  }
}
