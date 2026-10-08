import ExpoModulesCore
import UIKit

// Spike code. The point mapping and the one-pixel render follow Palette-iOS (MIT, Carlos Simon).

private let unresolvedView =
  "A view reference does not resolve to a native view. Set collapsable={false} on the captureRoot and on the foreground."

// EXPERIMENTAL. Compositor snapshot modes for the blur and glass evaluation. Off by default.
private let compositorModes: Set<String> = ["dhRootFalse", "dhRootTrue", "dhWindowFalse", "dhWindowTrue"]

private func paletteError(_ code: String, _ message: String) -> Exception {
  // The message repeats the code. The JS side does not depend on the `code` field format.
  return Exception(name: "PaletteSamplerException", description: "[\(code)] \(message)", code: code)
}

public class PaletteSamplerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PaletteSampler")

    // One main-queue block. No run-loop turn occurs between the exclusion and the restoration.
    AsyncFunction("sampleAsync") {
      (rootTag: Int, foregroundTag: Int, x: Double, y: Double, mode: String) -> [String: Any] in
      return try self.sample(rootTag: rootTag, foregroundTag: foregroundTag, x: x, y: y, mode: mode)
    }.runOnQueue(.main)

    AsyncFunction("inspectAsync") { (tag: Int) -> [String: Any] in
      guard let view = self.appContext?.findView(withTag: tag, ofType: UIView.self) else {
        throw paletteError("INVALID_VIEW_RELATIONSHIP", unresolvedView)
      }
      return self.snapshot(view)
    }.runOnQueue(.main)

    // Diagnostic. Rectangle of the view in window coordinates, for a comparison with a screenshot.
    AsyncFunction("locateAsync") { (tag: Int) -> [String: Any] in
      guard let view = self.appContext?.findView(withTag: tag, ofType: UIView.self), let window = view.window else {
        throw paletteError("INVALID_VIEW_RELATIONSHIP", unresolvedView)
      }
      let rect = view.convert(view.bounds, to: nil)
      return [
        "x": Double(rect.origin.x), "y": Double(rect.origin.y),
        "width": Double(rect.width), "height": Double(rect.height),
        "scale": Double(window.screen.scale),
      ]
    }.runOnQueue(.main)
  }

  /// Name of the effect that `layer.render(in:)` cannot draw, or nil.
  private func effectName(_ view: UIView) -> String? {
    guard let effectView = view as? UIVisualEffectView, let effect = effectView.effect else {
      return nil
    }
    // An instance of the base class draws no effect.
    if type(of: effect) == UIVisualEffect.self {
      return nil
    }
    return "\(type(of: view)) with \(type(of: effect))"
  }

  /// Lists the effect views in the capture root. The excluded foreground subtree is not visited.
  private func collectEffects(
    _ view: UIView, root: UIView, foreground: UIView, point: CGPoint, into hits: inout [[String: Any]]
  ) {
    if view === foreground || view.isHidden || view.alpha == 0 {
      return
    }
    if let name = effectName(view) {
      let local = root.convert(point, to: view)
      let frame = view.convert(view.bounds, to: root)
      hits.append([
        "name": name,
        "frame": [frame.origin.x, frame.origin.y, frame.width, frame.height].map { Double($0) },
        "containsPoint": view.bounds.contains(local),
      ])
    }
    for subview in view.subviews {
      collectEffects(subview, root: root, foreground: foreground, point: point, into: &hits)
    }
  }

  // EXPERIMENTAL. Reads one pixel from a compositor snapshot of the root or of the window.
  private func compositorPixel(
    root: UIView, window: UIWindow, pixelX: CGFloat, pixelY: CGFloat, scale: CGFloat, mode: String,
    into context: CGContext
  ) throws {
    let target: UIView = mode.contains("Window") ? window : root
    let afterScreenUpdates = mode.hasSuffix("True")
    let inRoot = CGPoint(x: root.bounds.origin.x + pixelX / scale, y: root.bounds.origin.y + pixelY / scale)
    let inTarget = root.convert(inRoot, to: target)
    let format = UIGraphicsImageRendererFormat()
    format.scale = scale
    format.opaque = false
    format.preferredRange = .standard
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: 1 / scale, height: 1 / scale), format: format)
    var drawn = false
    let image = renderer.image { _ in
      let rect = CGRect(
        x: -(inTarget.x - target.bounds.origin.x), y: -(inTarget.y - target.bounds.origin.y),
        width: target.bounds.width, height: target.bounds.height)
      drawn = target.drawHierarchy(in: rect, afterScreenUpdates: afterScreenUpdates)
    }
    guard drawn, let cgImage = image.cgImage else {
      throw paletteError("CAPTURE_FAILED", "drawHierarchy did not draw the snapshot.")
    }
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: 1, height: 1))
  }

  private func snapshot(_ view: UIView) -> [String: Any] {
    let t = view.transform
    return [
      "hidden": view.isHidden,
      "layerHidden": view.layer.isHidden,
      "alpha": Double(view.alpha),
      "layerOpacity": Double(view.layer.opacity),
      "frame": [view.frame.origin.x, view.frame.origin.y, view.frame.width, view.frame.height].map { Double($0) },
      "bounds": [view.bounds.origin.x, view.bounds.origin.y, view.bounds.width, view.bounds.height].map { Double($0) },
      "transform": [t.a, t.b, t.c, t.d, t.tx, t.ty].map { Double($0) },
      "userInteractionEnabled": view.isUserInteractionEnabled,
      "isAccessibilityElement": view.isAccessibilityElement,
      "accessibilityElementsHidden": view.accessibilityElementsHidden,
      "subviewIndex": view.superview?.subviews.firstIndex(of: view) ?? -1,
      "inWindow": view.window != nil,
    ]
  }

  private func snapshot(_ foreground: UIView, root: UIView) -> [String: Any] {
    var state = snapshot(foreground)
    state["rootLayerOpacity"] = Double(root.layer.opacity)
    state["rootAlpha"] = Double(root.alpha)
    return state
  }

  private func sample(rootTag: Int, foregroundTag: Int, x: Double, y: Double, mode: String) throws -> [String: Any] {
    let started = CACurrentMediaTime()
    guard x.isFinite, y.isFinite else {
      throw paletteError("INVALID_POINT", "The point must contain finite numbers.")
    }
    guard
      let root = appContext?.findView(withTag: rootTag, ofType: UIView.self),
      let foreground = appContext?.findView(withTag: foregroundTag, ofType: UIView.self)
    else {
      throw paletteError("INVALID_VIEW_RELATIONSHIP", unresolvedView)
    }
    guard let window = root.window, foreground !== root, foreground.isDescendant(of: root) else {
      throw paletteError("INVALID_VIEW_RELATIONSHIP", "The foreground is not an attached descendant of the capture root.")
    }
    guard root.bounds.width > 0, root.bounds.height > 0,
      foreground.bounds.width > 0, foreground.bounds.height > 0
    else {
      throw paletteError("NOT_READY", "The capture root or the foreground has a zero size.")
    }

    // `convert(_:to:)` is exact when the mapping is affine in the view plane.
    // `CATransform3DIsAffine` is too strict: React Native sets a z scale for `scale`.
    var node: UIView? = foreground
    while let current = node, current !== root {
      let transform = current.layer.transform
      let parentTransform = current.superview?.layer.sublayerTransform ?? CATransform3DIdentity
      if transform.m14 != 0 || transform.m24 != 0 || !CATransform3DIsAffine(parentTransform) {
        throw paletteError("UNSUPPORTED_CONTENT", "A perspective transform is between the foreground and the capture root.")
      }
      node = current.superview
    }

    let local = CGPoint(x: foreground.bounds.origin.x + x, y: foreground.bounds.origin.y + y)
    let mapped = foreground.convert(local, to: root)
    let captureX = mapped.x - root.bounds.origin.x
    let captureY = mapped.y - root.bounds.origin.y
    guard captureX.isFinite, captureY.isFinite,
      captureX >= 0, captureY >= 0, captureX < root.bounds.width, captureY < root.bounds.height
    else {
      throw paletteError("INVALID_POINT", "The mapped point (\(mapped.x), \(mapped.y)) is outside the capture root.")
    }

    // Rounding rule: the physical pixel that contains the logical point.
    let scale = window.screen.scale
    let pixelX = floor(captureX * scale)
    let pixelY = floor(captureY * scale)

    // `layer.render(in:)` does not draw a visual effect. Reject the sample. Do not return a wrong color.
    var effects: [[String: Any]] = []
    collectEffects(root, root: root, foreground: foreground, point: mapped, into: &effects)
    let compositor = compositorModes.contains(mode)
    if mode != "skipEffectCheck", !compositor,
      let hit = effects.first(where: { $0["containsPoint"] as? Bool == true })
    {
      throw paletteError(
        "UNSUPPORTED_CONTENT",
        "An effect view (\(hit["name"] ?? "")) covers the sample point. The capture cannot render this effect.")
    }

    let before = snapshot(foreground, root: root)
    var during: [String: Any] = [:]
    var pixel = [UInt8](repeating: 0, count: 4)

    try pixel.withUnsafeMutableBytes { bytes in
      guard
        let space = CGColorSpace(name: CGColorSpace.sRGB),
        let context = CGContext(
          data: bytes.baseAddress, width: 1, height: 1,
          bitsPerComponent: 8, bytesPerRow: 4, space: space,
          bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue)
      else {
        throw paletteError("CAPTURE_FAILED", "The bitmap context is not available.")
      }
      // UIKit orientation, then one context pixel for one physical pixel.
      context.translateBy(x: 0, y: 1)
      context.scaleBy(x: scale, y: -scale)
      context.translateBy(
        x: -(root.bounds.origin.x + pixelX / scale),
        y: -(root.bounds.origin.y + pixelY / scale))

      if compositor {
        // EXPERIMENTAL. No explicit transaction: `afterScreenUpdates: true` must see the hidden layer.
        CATransaction.setDisableActions(true)
        let wasHidden = foreground.layer.isHidden
        defer { foreground.layer.isHidden = wasHidden }
        foreground.layer.isHidden = true
        during = self.snapshot(foreground, root: root)
        context.concatenate(context.ctm.inverted())
        try self.compositorPixel(
          root: root, window: window, pixelX: pixelX, pixelY: pixelY, scale: scale, mode: mode, into: context)
        return
      }

      CATransaction.begin()
      CATransaction.setDisableActions(true)
      let wasHidden = foreground.layer.isHidden
      let rootOpacity = root.layer.opacity
      defer {
        root.layer.opacity = rootOpacity
        foreground.layer.isHidden = wasHidden
        CATransaction.commit()
      }
      if mode != "skipExclusion" {
        foreground.layer.isHidden = true
      }
      // The opacity of the capture root is not part of the sample.
      root.layer.opacity = 1
      during = self.snapshot(foreground, root: root)
      if mode == "failAfterHide" {
        throw paletteError("CAPTURE_FAILED", "Forced failure after the exclusion (debug mode).")
      }
      root.traitCollection.performAsCurrent {
        root.layer.render(in: context)
      }
    }

    let after = snapshot(foreground, root: root)
    let alpha = Double(pixel[3]) / 255
    let straight: (UInt8) -> Double = { channel in
      alpha > 0 ? min(Double(channel) / 255 / alpha, 1) : 0
    }
    return [
      "r": straight(pixel[0]),
      "g": straight(pixel[1]),
      "b": straight(pixel[2]),
      "a": alpha,
      "rawPremultiplied": pixel.map { Int($0) },
      "captureX": Double(captureX),
      "captureY": Double(captureY),
      "pixelX": Double(pixelX),
      "pixelY": Double(pixelY),
      "scale": Double(scale),
      "exclusion": mode == "skipExclusion" ? "none" : "layer.isHidden",
      "effects": effects,
      "before": before,
      "during": during,
      "after": after,
      "nativeMs": (CACurrentMediaTime() - started) * 1000,
    ]
  }
}
