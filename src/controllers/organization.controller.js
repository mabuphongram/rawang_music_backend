const Organization = require("../models/Organization");
const { minioUpload } = require("../utils/minioUpload.util");

async function withAvatar(body, file) {
  if (!file) return body;
  const objectName = await minioUpload("organization", file);
  return { ...body, avatarUrl: objectName };
}

async function listOrganizations(req, res) {
  const organizations = await Organization.find().sort({ createdAt: -1 });
  res.json(organizations);
}

async function getOrganization(req, res) {
  const organization = await Organization.findById(req.params.id);
  if (!organization) return res.status(404).json({ error: "Organization not found" });
  res.json(organization);
}

async function createOrganization(req, res) {
  const organization = await Organization.create(await withAvatar(req.body, req.file));
  res.status(201).json(organization);
}

async function updateOrganization(req, res) {
  const organization = await Organization.findByIdAndUpdate(req.params.id, await withAvatar(req.body, req.file), {
    new: true,
    runValidators: true,
  });
  if (!organization) return res.status(404).json({ error: "Organization not found" });
  res.json(organization);
}

async function deleteOrganization(req, res) {
  const organization = await Organization.findByIdAndDelete(req.params.id);
  if (!organization) return res.status(404).json({ error: "Organization not found" });
  res.status(204).send();
}

module.exports = { listOrganizations, getOrganization, createOrganization, updateOrganization, deleteOrganization };
