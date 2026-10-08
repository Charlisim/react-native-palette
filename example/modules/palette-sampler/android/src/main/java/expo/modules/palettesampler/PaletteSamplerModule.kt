package expo.modules.palettesampler

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.os.Build
import android.view.View
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.floor

// Spike code.

// The message repeats the code. The JS side does not depend on the `code` field format.
private fun paletteError(code: String, message: String, cause: Throwable? = null) =
  CodedException(code, "[$code] $message", cause)

class PaletteSamplerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PaletteSampler")

    // One UI-thread message. No frame is drawn between the exclusion and the restoration.
    AsyncFunction("sampleAsync") { rootTag: Int, foregroundTag: Int, x: Double, y: Double, mode: String ->
      sample(rootTag, foregroundTag, x, y, mode)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("inspectAsync") { tag: Int ->
      val view = resolve(tag)
        ?: throw paletteError("INVALID_VIEW_RELATIONSHIP", "The view reference does not resolve to a native view.")
      snapshot(view)
    }.runOnQueue(Queues.MAIN)
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
      throw paletteError("INVALID_VIEW_RELATIONSHIP", "A view reference does not resolve to a native view.")
    }
    if (foreground === root || !root.isAttachedToWindow || !foreground.isAttachedToWindow) {
      throw paletteError("INVALID_VIEW_RELATIONSHIP", "The foreground is not an attached descendant of the capture root.")
    }

    // Map the point from the foreground up to the capture root, in physical pixels.
    val density = root.resources.displayMetrics.density
    val point = floatArrayOf((x * density).toFloat(), (y * density).toFloat())
    var current: View = foreground
    while (current !== root) {
      val matrix = current.matrix
      if (!matrix.isIdentity) {
        if (!matrix.isAffine) {
          throw paletteError("UNSUPPORTED_CONTENT", "A non-affine transform is between the foreground and the capture root.")
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
      "before" to before,
      "during" to during,
      "after" to after,
      "nativeMs" to (System.nanoTime() - started) / 1e6
    )
  }
}
