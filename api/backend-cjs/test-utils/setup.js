"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const firestoreMock_1 = require("./firestoreMock");
beforeEach(() => {
    (0, firestoreMock_1.resetFirestoreMock)();
    jest.clearAllMocks();
});
