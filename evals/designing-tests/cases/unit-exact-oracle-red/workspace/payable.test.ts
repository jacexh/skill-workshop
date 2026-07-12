import { payable } from "./payable";

it("returns an amount", () => {
  expect(payable(10_000, true)).not.toBeNull();
});
