import { info } from "converter";

export async function run() {
  // Keep the event loop running.
  setTimeout(() => {
    process.exit(1);
  }, 60000);

  try {
    let res = await info();
    console.log(res);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
