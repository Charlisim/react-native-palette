declare module 'upng-js' {
  interface Image {
    width: number;
    height: number;
  }
  const UPNG: {
    decode(buffer: ArrayBuffer): Image;
    toRGBA8(image: Image): ArrayBuffer[];
  };
  export default UPNG;
}
