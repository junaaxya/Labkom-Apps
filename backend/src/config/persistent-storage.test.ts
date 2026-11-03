import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  ensureUploadDirectories,
  getUploadCategoryDir,
  getUploadPath,
  uploadCategories,
  toUploadUrl,
  parseUploadUrl,
  uploadRoot,
} from "./upload";

test("persistent upload root directory exists or is resolved", () => {
  assert.ok(uploadRoot.length > 0);
  assert.ok(path.isAbsolute(uploadRoot));
});

test("ensureUploadDirectories creates all required upload category folders", () => {
  ensureUploadDirectories();
  for (const category of uploadCategories) {
    const dir = getUploadCategoryDir(category);
    assert.ok(fs.existsSync(dir), `Directory for category ${category} should exist`);
    const stat = fs.statSync(dir);
    assert.ok(stat.isDirectory(), `Path ${dir} must be a directory`);
  }
});

test("getUploadPath prevents directory traversal attacks", () => {
  assert.throws(
    () => getUploadPath("tickets", "../secret.txt"),
    /Path file upload tidak valid/
  );
  assert.throws(
    () => getUploadPath("avatars", "../../etc/passwd"),
    /Path file upload tidak valid/
  );
});

test("upload files persist across read and write operations", () => {
  const testCategory = "conditions";
  const filename = `test_condition_${Date.now()}.jpg`;
  const filePath = getUploadPath(testCategory, filename);

  const testContent = Buffer.from("simulated-jpeg-binary-payload");
  fs.writeFileSync(filePath, testContent);

  try {
    assert.ok(fs.existsSync(filePath), "Uploaded file must persist on disk");
    const readContent = fs.readFileSync(filePath);
    assert.deepEqual(readContent, testContent, "Read content must match written content");

    const url = toUploadUrl(testCategory, filename);
    assert.equal(url, `/uploads/conditions/${filename}`);

    const parsed = parseUploadUrl(url);
    assert.notEqual(parsed, null);
    assert.equal(parsed?.category, testCategory);
    assert.equal(parsed?.filename, filename);
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});
