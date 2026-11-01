// Accordage guidé : une corde après l'autre, de la plus grave à la plus aiguë.
export function createGuide(count) {
  let i = 0;
  const done = new Set();
  return {
    done,
    get current() { return i < count ? i : null; },
    get finished() { return i >= count; },
    // La corde courante est juste : on la coche et on passe à la suivante (null à la fin)
    advance() {
      if (i >= count) return null;
      done.add(i);
      i++;
      return this.current;
    },
  };
}
