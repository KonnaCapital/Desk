import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type CloseDecision,
  registerCloseHandler,
  type CloseRequestEvent,
  type CloseWindow,
} from "./close.ts";

type CloseHandler = (event: CloseRequestEvent) => void | Promise<void>;

function closeHarness(registered = true) {
  let handler: CloseHandler | undefined;
  let prevented = 0;
  let destroyCalls = 0;
  const api: CloseWindow = {
    async onCloseRequested(next) {
      if (!registered) throw new Error("native listener unavailable");
      handler = next;
      return () => {};
    },
    async destroy() {
      destroyCalls += 1;
    },
  };
  return {
    api,
    invoke() {
      if (!handler) throw new Error("close handler was not registered");
      return handler({
        preventDefault() {
          prevented += 1;
        },
      });
    },
    get prevented() {
      return prevented;
    },
    get destroyCalls() {
      return destroyCalls;
    },
  };
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("close protection", () => {
  it("does not wait forever when persistence never settles", async () => {
    let handler!: (event: CloseRequestEvent) => void | Promise<void>;
    let destroyCalls = 0;
    let problem: string | undefined;
    let releaseFlush!: () => void;
    const flushReleased = new Promise<void>((resolve) => {
      releaseFlush = resolve;
    });
    const registration = await registerCloseHandler(
      {
        async onCloseRequested(next) {
          handler = next;
          return () => {};
        },
        async destroy() {
          destroyCalls += 1;
        },
      },
      () => flushReleased,
      (result) => {
        problem = result;
      },
      5,
    );
    assert.equal(registration.registered, true);

    await handler({ preventDefault() {} });
    assert.equal(problem, "timed-out");
    assert.equal(destroyCalls, 0);
    releaseFlush();
    await Promise.resolve();
    assert.equal(destroyCalls, 0);
  });

  it("awaits native close registration and flushes before destroying once", async () => {
    let handler: ((event: CloseRequestEvent) => void | Promise<void>) | undefined;
    let handlerRegistered = false;
    let flushCalls = 0;
    let destroyCalls = 0;
    let releaseFlush!: () => void;
    let releaseRegistration!: () => void;
    const flushReleased = new Promise<void>((resolve) => {
      releaseFlush = resolve;
    });
    const registrationReleased = new Promise<void>((resolve) => {
      releaseRegistration = resolve;
    });
    const api: CloseWindow = {
      async onCloseRequested(next) {
        await registrationReleased;
        handler = next;
        handlerRegistered = true;
        return () => {};
      },
      async destroy() {
        destroyCalls += 1;
      },
    };

    let registrationSettled = false;
    const registrationPromise = registerCloseHandler(
      api,
      async () => {
        flushCalls += 1;
        await flushReleased;
      },
      () => {},
    );
    void registrationPromise.then(() => {
      registrationSettled = true;
    });
    await Promise.resolve();
    assert.equal(registrationSettled, false);
    assert.equal(handlerRegistered, false);
    releaseRegistration();
    const registration = await registrationPromise;
    assert.equal(registration.registered, true);
    assert.equal(handlerRegistered, true);

    let prevented = 0;
    const closePromise = handler!({
      preventDefault() {
        prevented += 1;
      },
    });
    await Promise.resolve();
    assert.equal(prevented, 1);
    assert.equal(flushCalls, 1);
    assert.equal(destroyCalls, 0);

    releaseFlush();
    await closePromise;
    assert.equal(destroyCalls, 1);
  });

  it("reports a native close registration failure", async () => {
    const registration = await registerCloseHandler(
      {
        async onCloseRequested() {
          throw new Error("native listener unavailable");
        },
        async destroy() {},
      },
      async () => {},
      () => {},
    );
    assert.equal(registration.registered, false);
  });

  it("keeps the window open after a failed save, then retries a new close", async () => {
    const h = closeHarness();
    let flushCalls = 0;
    const problems: string[] = [];
    const registration = await registerCloseHandler(
      h.api,
      async () => {
        flushCalls += 1;
        return flushCalls === 1 ? "error" : "saved";
      },
      (result) => {
        problems.push(result);
        return "keep-open";
      },
    );

    await registration.requestClose();
    assert.deepEqual(problems, ["failed"]);
    assert.equal(flushCalls, 1);
    assert.equal(h.destroyCalls, 0);

    await registration.requestClose();
    assert.equal(flushCalls, 2);
    assert.equal(h.destroyCalls, 1);
  });

  it("destroys only after an explicit discard decision", async () => {
    const h = closeHarness();
    let flushCalls = 0;
    let problem: string | undefined;
    const registration = await registerCloseHandler(
      h.api,
      async () => {
        flushCalls += 1;
        return "error";
      },
      (result) => {
        problem = result;
        return "discard";
      },
    );

    await registration.requestClose();
    assert.equal(problem, "failed");
    assert.equal(flushCalls, 1);
    assert.equal(h.destroyCalls, 1);
  });

  it("retries failed saves until a later flush succeeds", async () => {
    const h = closeHarness();
    let flushCalls = 0;
    let problemCalls = 0;
    const registration = await registerCloseHandler(
      h.api,
      async () => {
        flushCalls += 1;
        return flushCalls === 1 ? "error" : "saved";
      },
      () => {
        problemCalls += 1;
        return "retry";
      },
    );

    await registration.requestClose();
    assert.equal(flushCalls, 2);
    assert.equal(problemCalls, 1);
    assert.equal(h.destroyCalls, 1);
  });

  it("coalesces duplicate close requests while a flush is pending", async () => {
    const h = closeHarness();
    let releaseFlush!: () => void;
    let flushCalls = 0;
    const flushReleased = new Promise<void>((resolve) => {
      releaseFlush = resolve;
    });
    const registration = await registerCloseHandler(
      h.api,
      async () => {
        flushCalls += 1;
        await flushReleased;
        return "saved";
      },
      () => "keep-open",
    );

    const first = h.invoke();
    const duplicate = h.invoke();
    await Promise.resolve();
    assert.equal(flushCalls, 1);
    assert.equal(h.prevented, 2);
    assert.equal(h.destroyCalls, 0);

    releaseFlush();
    await Promise.all([first, duplicate]);
    assert.equal(h.destroyCalls, 1);
  });

  it("coalesces duplicate close requests while the save prompt is pending", async () => {
    const h = closeHarness();
    let releasePrompt!: (decision: CloseDecision) => void;
    let promptCalls = 0;
    const prompt = new Promise<CloseDecision>((resolve) => {
      releasePrompt = resolve;
    });
    const registration = await registerCloseHandler(
      h.api,
      async () => "error",
      () => {
        promptCalls += 1;
        return prompt;
      },
    );

    const first = h.invoke();
    await nextTick();
    assert.equal(promptCalls, 1);
    const duplicate = h.invoke();
    assert.equal(promptCalls, 1);
    assert.equal(h.prevented, 2);
    assert.equal(h.destroyCalls, 0);

    releasePrompt("keep-open");
    await Promise.all([first, duplicate]);
    assert.equal(h.destroyCalls, 0);
  });

  it("leaves the window open when the save prompt throws", async () => {
    const h = closeHarness();
    const registration = await registerCloseHandler(
      h.api,
      async () => "error",
      () => {
        throw new Error("dialog unavailable");
      },
    );

    await registration.requestClose();
    assert.equal(h.destroyCalls, 0);
  });

  it("keeps the fallback requestClose usable when registration fails", async () => {
    const h = closeHarness(false);
    let flushCalls = 0;
    const registration = await registerCloseHandler(
      h.api,
      async () => {
        flushCalls += 1;
        return "saved";
      },
      () => "keep-open",
    );

    assert.equal(registration.registered, false);
    await registration.requestClose();
    assert.equal(flushCalls, 1);
    assert.equal(h.destroyCalls, 1);
  });

  it("does not destroy after a timed-out flush resolves late", async () => {
    const h = closeHarness();
    let releaseFlush!: () => void;
    const flushReleased = new Promise<void>((resolve) => {
      releaseFlush = resolve;
    });
    const registration = await registerCloseHandler(
      h.api,
      async () => {
        await flushReleased;
        return "saved";
      },
      (result) => {
        assert.equal(result, "timed-out");
        return "keep-open";
      },
      5,
    );

    await registration.requestClose();
    assert.equal(h.destroyCalls, 0);
    releaseFlush();
    await Promise.resolve();
    assert.equal(h.destroyCalls, 0);
  });
});
