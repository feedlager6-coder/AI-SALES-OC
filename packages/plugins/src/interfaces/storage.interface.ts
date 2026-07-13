export interface IStoragePlugin {
  readonly name: string
  readonly category: 'storage'

  upload(key: string, data: Buffer, mimeType: string): Promise<{ url: string }>
  download(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
}
