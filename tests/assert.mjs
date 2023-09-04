function success(msg) {
  console.log('\x1b[36mSuccess:\x1b[0m', msg);
}

function error(msg) {
  console.log('\x1b[31mError:\x1b[0m', msg);
}

export function assert_true(msg, bool) {
  if (!bool) {
    error(msg);
    process.exit(1);
  }
  success(msg);
}

export function assert(msg, a, b) {
  if (a != b) {
    error(`${msg}. ${a} != ${b}`);
    process.exit(1);
  }
  success(msg);
}

export function assert_deep_equal(msg, a, b) {
  let d = diff(a, b);
  if (d) {
    error(`${msg}. ${d}`);
    process.exit(1);
  }
  success(msg);
}

// https://dmitripavlutin.com/how-to-compare-objects-in-javascript/
function diff(object1, object2) {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return "keys count different";
  }

  for (const key of keys1) {
    const val1 = object1[key];
    const val2 = object2[key];
    const areObjects = isObject(val1) && isObject(val2);
    if (areObjects) {
      let d = diff(val1, val2);
      if (d) {
        return `[${key}] differs: ${d}`;
      }
    } else {
      if (val1 !== val2) {
        return `[${key}] differs: ${val1} != ${val2}`;
      }
    }
  }

  return null;
}

function isObject(object) {
  return object != null && typeof object === 'object';
}
