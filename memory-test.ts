async function createMemoryIntensiveLoad() {
  let largeArray = [];

  // Create a large array of objects to simulate memory usage
  for (let i = 0; i < 100000000000; i++) {
    largeArray.push({
      index: i,
      timestamp: Date.now(),
      randomString: Math.random().toString(36).substring(2, 15)
    });
  }
  // write log to file
  console.log(`Created a large array with ${largeArray.length} objects`);
}

await createMemoryIntensiveLoad();
