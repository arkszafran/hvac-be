declare module 'fast-crc32c' {
  const crc32c: {
    calculate(input: Buffer | string): number;
  };

  export default crc32c;
}
