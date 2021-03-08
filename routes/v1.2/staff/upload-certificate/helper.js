const crypto = require("crypto");
const { encrypt } = require("eciesjs");
const connection = require("../../../../db");

function parseExcel(rows) {
  rows.shift();
  return rows.map((row) => ({
    studentId: row[0].toString(),
    faculty: row[1],
    degree: row[2],
    gradyear: row[3],
    level: row[4],
    eduform: row[5],
    issuelocation: row[6],
    issuedate: row[7].toString(),
    headmaster: row[8],
    regisno: row[9].toString(),
    globalregisno: row[10].toString(),
  }));
}

async function addUniversityName(certs) {
  const col = (await connection).db().collection("UniversityProfile");
  const university = await col.findOne({});
  certs.forEach((cert) => {
    cert.university = university.universityName;
  });
}

async function addStudentInfoByStudentId(certs) {
  const certsPromises = certs.map(async (cert) => {
    const student = await getStudentByStudentId(cert.studentId);
    return {
      ...cert,
      name: student.name,
      birthday: student.birthday,
      gender: student.gender,
      publicKey: student.publicKey,
      eduProgramId: student.eduProgram.eduProgramId,
      school: student.school,
    };
  });
  return Promise.all(certsPromises);
}

async function getStudentByStudentId(studentId) {
  const studentHistoryCol = (await connection).db().collection("StudentHistory");
  const doc = await studentHistoryCol.findOne({ "profiles.studentId": studentId }, { projection: { "profiles.$": 1, _id: 0 } });
  return doc ? doc.profiles[0] : null;
}

function encryptCerts(certs) {
  return certs.map((cert) => encrypt(cert.publicKey, Buffer.from(JSON.stringify(cert))).toString("hex"));
}

function hashCerts(certs) {
  return certs.map((cert) => crypto.createHash("sha256").update(JSON.stringify(cert)).digest("hex"));
}

function addEncrypt(certs) {
  certs.forEach((cert) => {
    cert.cipher = encrypt(cert.publicKey, Buffer.from(JSON.stringify(cert))).toString("hex");
  });
}

function addHashCert(certs) {
  certs.forEach((cert) => {
    cert.hash = crypto.createHash("sha256").update(JSON.stringify(cert)).digest("hex");
  });
}

function preparePayload(certs) {
  return certs.map((cert) => ({
    school: cert.school,
    eduProgramId: cert.eduProgramId,
    studentPublicKey: cert.publicKey,
    cipher: cert.cipher,
    hash: cert.hash,
  }));
}
function addType(certs, eventType) {
  certs.forEach((cert) => (cert.type = eventType));
}

function addTimestamp(certs) {
  certs.forEach((cert) => (cert.timestamp = Date.now()));
} // to know which newest

module.exports = {
  hashCerts,
  encryptCerts,
  addStudentInfoByStudentId,
  addUniversityName,
  parseExcel,
  addEncrypt,
  addHashCert,
  preparePayload,
  addTimestamp,
  addType,
};
