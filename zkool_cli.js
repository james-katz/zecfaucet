
const { ZkoolClient } = require('./zkool.js');

const main = async () => {
  const args = process.argv.slice(2);
  const methodName = args[0];
  const methodArgs = args.slice(1);

  if (!methodName) {
    console.error('Please provide a method name.');
    process.exit(1);
  }

  const endpoint = process.env.ZKOOL_ENDPOINT || 'http://127.0.0.1:8000/graphql';
  const client = new ZkoolClient(endpoint);

  if (typeof client[methodName] !== 'function') {
    console.error(`Method "${methodName}" does not exist on ZkoolClient.`);
    process.exit(1);
  }

  try {
    await client.init();
    const parsedArgs = methodArgs.map(arg => {
      try {
        // Try parsing as JSON to handle numbers, booleans, and objects/arrays
        return JSON.parse(arg);
      } catch (e) {
        // If it fails, treat it as a string
        return arg;
      }
    });

    const result = await client[methodName](...parsedArgs);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(`Error executing method "${methodName}":`, error.message);
    process.exit(1);
  }
};

main();
