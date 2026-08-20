export function verificationHookToken(documentId: string): string {
  return `verify:${documentId}`;
}
