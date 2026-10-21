/** Tests imageUpload.ts: file validation, real upload/delete flows and permission/storage/database failures at the mocked Supabase boundary. */
import { supabase } from '../supabase';
import { uploadAvatarImage, deleteAvatarImage, uploadTutorImage, deleteTutorImage, validateImageFile } from '../imageUpload';

jest.mock('../supabase', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() }, auth: { getUser: jest.fn() } }
}));

const client = supabase as any;
const user = { id: 'tutor-1', current_role: 'tutor' };
const publicUrl = 'https://test.supabase.co/storage/v1/object/public/avatars/tutor-1/avatar.jpg';
const image = { id: 'image-1', tutor_id: user.id, room_id: 'room-1', image_url: publicUrl, is_active: true };
const storage = { upload: jest.fn(), remove: jest.fn(), getPublicUrl: jest.fn() };

function table(data: unknown) {
  return {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(), insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error: null })
  };
}

let tables: Record<string, ReturnType<typeof table>>;
let file: File;

beforeEach(() => {
  jest.clearAllMocks();
  file = new File(['image bytes'], 'photo.jpg', { type: 'image/jpeg' });
  tables = { users: table({ ...user, avatar_url: publicUrl }), rooms: table({ tutor_id: user.id }), tutor_images: table(image) };
  client.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  client.from.mockImplementation((name: string) => tables[name]);
  client.storage.from.mockReturnValue(storage);
  storage.upload.mockResolvedValue({ data: { path: 'uploaded' }, error: null });
  storage.remove.mockResolvedValue({ data: null, error: null });
  storage.getPublicUrl.mockReturnValue({ data: { publicUrl } });
});

describe('image file validation', () => {
  it('accepts supported images and reports file metadata', async () => {
    expect(await validateImageFile(file)).toMatchObject({ isValid: true, errors: [], fileSize: file.size, fileType: file.type });
  });

  it.each([
    ['empty', new File([], 'empty.jpg', { type: 'image/jpeg' })],
    ['oversized', new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })],
    ['unsupported type', new File(['text'], 'file.txt', { type: 'text/plain' })],
    ['unsupported extension', new File(['image'], 'file.bmp', { type: 'image/jpeg' })]
  ])('rejects %s files', async (_, invalid) => {
    const result = await validateImageFile(invalid);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('checks dimensions and rejects oversized dimensions', async () => {
    global.URL.createObjectURL = jest.fn(() => 'blob:image');
    global.URL.revokeObjectURL = jest.fn();
    const original = global.Image;
    global.Image = class {
      width = 1024; height = 768; onload: (() => void) | null = null;
      set src(_: string) { this.onload?.(); }
    } as any;
    try {
      expect((await validateImageFile(file, { maxWidth: 1920, maxHeight: 1080 })).isValid).toBe(true);
      expect((await validateImageFile(file, { maxWidth: 800 })).isValid).toBe(false);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:image');
    } finally { global.Image = original; }
  });
});

describe('avatar operations', () => {
  it('uploads the file and stores the returned URL for the authenticated user', async () => {
    expect(await uploadAvatarImage(file)).toMatchObject({ success: true, avatarUrl: publicUrl, previousAvatarRemoved: true });
    expect(client.storage.from).toHaveBeenCalledWith('avatars');
    expect(storage.upload).toHaveBeenCalledWith('tutor-1/avatar.jpg', file, { cacheControl: '3600', upsert: true });
    expect(tables.users.update).toHaveBeenCalledWith({ avatar_url: publicUrl });
    expect(tables.users.eq).toHaveBeenCalledWith('id', user.id);
  });

  it('deletes storage and clears the persisted avatar URL', async () => {
    expect(await deleteAvatarImage()).toMatchObject({ success: true });
    expect(storage.remove).toHaveBeenCalled();
    expect(tables.users.update).toHaveBeenCalledWith({ avatar_url: null });
  });

  it('cleans uploaded storage if persisting the URL fails', async () => {
    tables.users.single.mockResolvedValue({ data: null, error: { message: 'write failed' } });
    expect(await uploadAvatarImage(file)).toMatchObject({ success: false, error: expect.stringContaining('write failed') });
    expect(storage.remove).toHaveBeenLastCalledWith(['tutor-1/avatar.jpg']);
  });
});

describe('tutor image operations', () => {
  it('checks role and room ownership before uploading and persists all image metadata', async () => {
    expect(await uploadTutorImage(file, 'room-1')).toEqual({ success: true, tutorImage: image });
    expect(tables.rooms.eq).toHaveBeenCalledWith('tutor_id', user.id);
    expect(storage.upload).toHaveBeenCalledWith(expect.stringMatching(/^tutor-1\/\d+-photo\.jpg$/), file, { cacheControl: '3600' });
    expect(tables.tutor_images.insert).toHaveBeenCalledWith({
      tutor_id: user.id, room_id: 'room-1', image_url: publicUrl, filename: file.name, file_size: file.size, is_active: true
    });
  });

  it('rejects a non-tutor before uploading', async () => {
    tables.users.single.mockResolvedValue({ data: { current_role: 'student' }, error: null });
    expect((await uploadTutorImage(file, 'room-1')).success).toBe(false);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('rejects a missing or inaccessible room before uploading', async () => {
    tables.rooms.single.mockResolvedValue({ data: null, error: null });
    expect((await uploadTutorImage(file, 'room-1')).success).toBe(false);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('removes a failed database upload from storage', async () => {
    tables.tutor_images.single.mockResolvedValue({ data: null, error: { message: 'constraint failure' } });
    expect((await uploadTutorImage(file, 'room-1')).success).toBe(false);
    expect(storage.remove).toHaveBeenCalledWith([expect.stringMatching(/^tutor-1\//)]);
  });

  it('verifies ownership, deletes storage and soft-deletes image metadata', async () => {
    expect(await deleteTutorImage(image.id)).toEqual({ success: true });
    expect(tables.tutor_images.eq).toHaveBeenCalledWith('id', image.id);
    expect(tables.tutor_images.eq).toHaveBeenCalledWith('tutor_id', user.id);
    expect(tables.tutor_images.update).toHaveBeenCalledWith({ is_active: false });
  });

  it('rejects missing images and preserves metadata when storage deletion fails', async () => {
    tables.tutor_images.single.mockResolvedValueOnce({ data: null, error: null });
    expect((await deleteTutorImage('missing')).success).toBe(false);
    expect(storage.remove).not.toHaveBeenCalled();
    storage.remove.mockResolvedValue({ error: { message: 'storage unavailable' } });
    expect((await deleteTutorImage(image.id)).success).toBe(false);
    expect(tables.tutor_images.update).not.toHaveBeenCalled();
  });
});

describe('upload failures', () => {
  it.each([uploadAvatarImage, (value: File) => uploadTutorImage(value, 'room-1')])('rejects unauthenticated uploads', async upload => {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await upload(file)).success).toBe(false);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('returns storage/network errors without writing database metadata', async () => {
    storage.upload.mockResolvedValueOnce({ data: null, error: { message: 'access denied' } });
    expect(await uploadAvatarImage(file)).toMatchObject({ success: false, error: expect.stringContaining('access denied') });
    storage.upload.mockRejectedValueOnce(new Error('network failed'));
    expect(await uploadAvatarImage(file)).toMatchObject({ success: false, error: 'network failed' });
    expect(tables.users.update).not.toHaveBeenCalled();
  });
});
