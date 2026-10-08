import ExpoModulesCore
import UIKit

// Spike code. The point mapping and the one-pixel render follow Palette-iOS (MIT, Carlos Simon).

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
        throw paletteError("INVALID_VIEW_RELATIONSHIP", "The view reference does not resolve to a native view.")
      }
      return self.snapshot(view)
    }.runOnQueue(.main)
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

  private func sample(rootTag: Int, foregroundTag: Int, x: Double, y: Double, mode: String) throws -> [String: Any] {
    let started = CACurrentMediaTime()
    guard x.isFinite, y.isFinite else {
      throw paletteError("INVALID_POINT", "The point must contain finite numbers.")
    }
    guard
      let root = appContext?.findView(withTag: rootTag, ofType: UIView.self),
      let foreground = appContext?.findView(withTag: foregroundTag, ofType: UIView.self)
    else {
      throw paletteError("INVALID_VIEW_RELATIONSHIP", "A view reference does not resolve to a native view.")
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

    let before = snapshot(foreground)
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

      CATransaction.begin()
      CATransaction.setDisableActions(true)
      let wasHidden = foreground.layer.isHidden
      defer {
        foreground.layer.isHidden = wasHidden
        CATransaction.commit()
      }
      if mode != "skipExclusion" {
        foreground.layer.isHidden = true
      }
      during = self.snapshot(foreground)
      if mode == "failAfterHide" {
        throw paletteError("CAPTURE_FAILED", "Forced failure after the exclusion (debug mode).")
      }
      root.traitCollection.performAsCurrent {
        root.layer.render(in: context)
      }
    }

    let after = snapshot(foreground)
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
      "before": before,
      "during": during,
      "after": after,
      "nativeMs": (CACurrentMediaTime() - started) * 1000,
    ]
  }
}
