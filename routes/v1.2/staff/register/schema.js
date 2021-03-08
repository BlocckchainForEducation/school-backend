const Joi = require("joi");

const profileSchema = Joi.object({
  _id: Joi.string(),
  uid: Joi.string(),
  universityName: Joi.string().required(),
  nameInEnglish: Joi.string().required(),
  address: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string()
    .pattern(/(03|07|08|09|01[2|6|8|9])+([0-9]{8})\b/)
    .required(),
  publicKey: Joi.string()
    .pattern(/([0-9A-Fa-f]{66})/)
    .required(),
  description: Joi.string().max(1000),
  imgSrc: Joi.string(),
  state: Joi.string(),
  votes: Joi.array(),
});

module.exports = { profileSchema };
