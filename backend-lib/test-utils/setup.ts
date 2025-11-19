import { resetFirestoreMock } from "./firestoreMock";

beforeEach(() => {
  resetFirestoreMock();
  jest.clearAllMocks();
});
