const Organization = require("../models/Organization");

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
  const organization = await Organization.create(req.body);
  res.status(201).json(organization);
}

async function updateOrganization(req, res) {
  const organization = await Organization.findByIdAndUpdate(req.params.id, req.body, {
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
