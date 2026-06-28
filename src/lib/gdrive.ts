import { google } from "googleapis";
import { Readable } from "stream";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Google private key in .env might have \n characters represented as literal '\n'
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    // If not configured, return null so we can degrade gracefully in dev environment
    return null;
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: SCOPES,
  });

  return google.drive({ version: "v3", auth });
}

/**
 * Creates a folder in Google Drive.
 * @param name Folder name
 * @param parentId Optional parent folder ID
 */
export async function createDriveFolder(name: string, parentId?: string): Promise<string | null> {
  try {
    const drive = getDriveClient();
    if (!drive) {
      console.warn("Google Drive client not configured. Skipping folder creation.");
      return null;
    }

    const actualParentId = parentId || process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

    const fileMetadata = {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: actualParentId ? [actualParentId] : undefined,
    };

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id",
    });

    return folder.data.id || null;
  } catch (err) {
    console.error("Error creating Google Drive folder:", err);
    return null;
  }
}

/**
 * Uploads a file buffer to a Google Drive folder.
 * @param folderId Parent folder ID
 * @param fileName Name of the file
 * @param mimeType MIME type of the file
 * @param body File buffer
 */
export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  mimeType: string,
  body: Buffer
): Promise<{ id: string; webViewLink: string } | null> {
  try {
    const drive = getDriveClient();
    if (!drive) {
      console.warn("Google Drive client not configured. Skipping file upload.");
      return null;
    }

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType,
      body: Readable.from(body),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, webViewLink",
    });

    // Make the file readable by anyone with the link (since we want administrators to access it)
    try {
      await drive.permissions.create({
        fileId: file.data.id!,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
    } catch (permErr) {
      console.warn("Failed to set public read permissions on uploaded file:", permErr);
    }

    return {
      id: file.data.id!,
      webViewLink: file.data.webViewLink!,
    };
  } catch (err) {
    console.error("Error uploading file to Google Drive:", err);
    return null;
  }
}

/**
 * Lists files inside a specific Google Drive folder.
 * @param folderId Target folder ID
 */
export async function listFilesInFolder(
  folderId: string
): Promise<Array<{ id: string; name: string; webViewLink: string; mimeType: string }>> {
  try {
    const drive = getDriveClient();
    if (!drive) {
      return [];
    }

    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, webViewLink, mimeType)",
      orderBy: "createdTime desc",
    });

    return (res.data.files || []).map((f) => ({
      id: f.id!,
      name: f.name!,
      webViewLink: f.webViewLink!,
      mimeType: f.mimeType!,
    }));
  } catch (err) {
    console.error("Error listing files in Google Drive folder:", err);
    return [];
  }
}
