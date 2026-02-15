import { type Mock } from "vitest"

/** Type-safe cast for vi.fn() mocked functions. Replaces verbose `as ReturnType<typeof vi.fn>` */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asMock<T extends (...args: any[]) => any>(fn: T): Mock<T> {
  return fn as unknown as Mock<T>
}
