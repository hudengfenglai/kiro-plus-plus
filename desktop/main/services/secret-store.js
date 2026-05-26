export function createSecretStore({
  serviceName = "kiro-plus-plus",
  adapter,
  loadAdapter = async () => {
    const module = await import("keytar");
    return module.default ?? module;
  }
} = {}) {
  let cachedAdapter = adapter;

  async function getAdapter() {
    if (cachedAdapter) return cachedAdapter;
    cachedAdapter = await loadAdapter();
    return cachedAdapter;
  }

  return {
    async get(account) {
      const keytar = await getAdapter();
      return keytar.getPassword(serviceName, account);
    },
    async set(account, value) {
      const keytar = await getAdapter();
      await keytar.setPassword(serviceName, account, value);
    },
    async delete(account) {
      const keytar = await getAdapter();
      await keytar.deletePassword(serviceName, account);
    }
  };
}
