const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();
const { authen, author } = require("../../acc/protect-middleware");
const { ROLE } = require("../../acc/role");
const connection = require("../../../db");

const readXlsxFile = require("read-excel-file/node");
const { parseExcel, preparePayload, sendToBKC } = require("./helper");
const {
  bufferToStream,
  addUniversityPublicKey,
  addKeyPairIfNeed,
  addTxid,
  addRandomPwAndHash,
  addRole,
  addUid,
  createAccount,
  saveProfiles,
} = require("../utils");

router.post("/create-bureau", authen, author(ROLE.STAFF), upload.single("excel-file"), async (req, res) => {
  try {
    const rows = await readXlsxFile(bufferToStream(req.file.buffer));
    let bureaus = parseExcel(rows);
    // TODO: check bureauId exists? filter it?
    addUniversityPublicKey(bureaus, req.body.privateKeyHex);
    addKeyPairIfNeed(bureaus);
    const payload = preparePayload(bureaus);
    try {
      const response = await sendToBKC(payload, req.body.privateKeyHex);
      addTxid(bureaus, response.data.transactions, "bureauId");
      addRandomPwAndHash(bureaus);
      addRole(bureaus, ROLE.BUREAU);
      const insertedIds = await createAccount(bureaus);
      addUid(bureaus, insertedIds);
      const result = await saveProfiles(bureaus, "BureauHistory");
      res.json(result.ops[0]);
    } catch (error) {
      console.error(error?.response?.data);
      return res.status(502).send(error?.response?.data);
    }
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

router.get("/bureau-history", authen, author(ROLE.STAFF), async (req, res) => {
  try {
    const bureauHistoryCol = (await connection).db().collection("BureauHistory");
    const result = await bureauHistoryCol.find().toArray();
    res.json(result);
  } catch (error) {
    res.status(500).send(error.toString());
  }
});

module.exports = router;
