class IDCounter {
  constructor() {
    this.currentId = 0;
  }

  getUniqueId() {
    return this.currentId++;
  }
}

idCounter = new IDCounter();
