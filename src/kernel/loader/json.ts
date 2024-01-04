export default function loadJSON(fileString: string) : Promise<unknown> {
  try {
    return Promise.resolve(JSON.parse(fileString));
  } catch (e) {
    return Promise.reject(e);
  }
}
