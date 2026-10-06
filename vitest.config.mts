// Restrict discovery to source tests so old compiled tests cannot run twice.
export default { test: { include: ["src/**/*.test.ts"], environment: "node" } };
