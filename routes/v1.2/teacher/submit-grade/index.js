const express = require("express");
const router = express.Router();
const { authen, author } = require("../../acc/protect-middleware");
const { ROLE } = require("../../acc/role");
const connection = require("../../../../db");
const axios = require("axios").default;
const ObjectID = require("mongodb").ObjectID;
const crypto = require("crypto");
const { encrypt } = require("eciesjs");

const { randomTxid } = require("../../../utils");

router.get("/my-classes", authen, author(ROLE.TEACHER), async (req, res) => {
  try {
    const col = (await connection).db().collection("TeacherHistory");
    const doc = await col.findOne({ "profiles.uid": new ObjectID(req.user.uid) }, { projection: { "profiles.$": 1, _id: 0 } });
    const teacherProfile = doc.profiles[0];
    const classColl = (await connection).db().collection("Class");
    const classes = await classColl.find({ teacherId: teacherProfile.teacherId }).toArray();
    return res.json(classes);
  } catch (error) {
    console.error(error);
    return res.status(500).send(error.toString());
  }
});

router.get("/classes/:classId", authen, author(ROLE.TEACHER), async (req, res) => {
  try {
    const classId = req.params.classId;
    const classCol = (await connection).db().collection("Class");
    const docs = await classCol.findOne({ classId: classId });
    res.json(docs);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.toString());
  }
});

router.post("/save-draff", authen, author(ROLE.TEACHER), async (req, res) => {
  try {
    const teacherColl = (await connection).db().collection("TeacherHistory");
    const doc = await teacherColl.findOne({ "profiles.uid": new ObjectID(req.user.uid) }, { projection: { "profiles.$": 1, _id: 0 } });
    const teacherProfile = doc.profiles[0];
    const claxx = req.body.claxx;
    const classColl = (await connection).db().collection("Class");
    const opReuslt = await classColl.updateOne(
      { teacherId: teacherProfile.teacherId, classId: claxx.classId },
      { $set: { students: claxx.students } }
    );
    return res.json(opReuslt);
  } catch (error) {
    console.error(error);
    return res.status(500).send(error);
  }
});

router.post("/submit-grade", authen, author(ROLE.TEACHER), async (req, res) => {
  try {
    const classCol = (await connection).db().collection("Class");
    const privateKeyHex = req.body.privateKeyHex;
    const claxx = req.body.claxx;
    // require teacher != null
    const payload = preparePayload(privateKeyHex, claxx.teacher.universityPublicKey, claxx);
    try {
      // const response = await axios.post("/submit-point", payload);
      const mockupData = payload.grades.map((grade) => ({ studentPublicKey: grade.studentPublicKey, transactionId: randomTxid() }));
      const response = {
        data: {
          transactions: mockupData,
        },
      };
      claxx.students.forEach((student) => (student.versions[0].txid = findTxid(response.data.transactions, student.publicKey)));
      const opResult = await classCol.updateOne({ classId: claxx.classId }, { $set: { students: claxx.students, isSubmited: true } });
      claxx.isSubmited = true;
      return res.json(claxx); // front-end need txid, isSubmited from this class
    } catch (error) {
      console.error(error);
      if (error.response) return res.status(502).send(error.response.data);
      return res.status(502).send(error.toString());
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send(error.toString());
  }
});

function preparePayload(privateKeyHex, universityPublicKey, claxx) {
  const grades = claxx.students.map((student) => {
    const plain = {
      semester: claxx.semester,
      subject: claxx.subject,
      classId: claxx.classId,
      teacherId: claxx.teacher.teacherId,
      teacherName: claxx.teacher.name,
      department: claxx.teacher.department,
      studentId: student.studentId,
      studentName: student.name,
      versions: student.versions,
    };
    const cipher = encrypt(student.publicKey, Buffer.from(JSON.stringify(plain))).toString("hex");
    const hash = crypto.createHash("sha256").update(JSON.stringify(plain)).digest("hex");
    return { studentPublicKey: student.publicKey, eduProgramId: student.eduProgram.eduProgramId, cipher, hash };
  });
  return { privateKeyHex, universityPublicKey, classId: claxx.classId, grades };
}

function findTxid(txs, publicKey) {
  return txs.find((tx) => tx.studentPublicKey === publicKey).transactionId;
}

module.exports = router;
