// Shared schema transform: expose Mongo's _id as a string `id`, drop __v/_id.
function toJSON(schema) {
  schema.set("toJSON", {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
    },
  });
}

module.exports = toJSON;
