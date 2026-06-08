export function describeWorkbenchSnapshotAvailability(snapshot) {
  if (!snapshot) {
    return {
      state: "unknown",
      label: "暂无",
      detail: ""
    };
  }

  if (snapshot.exists === false) {
    return {
      state: "missing",
      label: "文件缺失",
      detail: "这个工作台快照文件已经不在磁盘上"
    };
  }

  return {
    state: "ready",
    label: "可打开",
    detail: "这个工作台快照文件仍可直接打开"
  };
}
