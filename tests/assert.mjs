export function assert_true(msg, bool) {
  if (!bool) {
    console.error("Assert failed", msg);
    process.exit(1);
  }
}

export function assert(msg, a, b) {
  if (a != b) {
    console.error(`Assert failed: ${msg}. ${a} != ${b}`);
    process.exit(1);
  }
}


