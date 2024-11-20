import { generateAndUploadInvoice } from "./invoiceUpload";

const invoiceData = {
  invoiceNumber: "INV001",
  invoiceDate: "2024-03-19",
  metalType: "Gold",
  karat: "24K",
  purity: "99.9%",
  hsnCode: "123456",
  quantity: 10,
  rate: 5000,
  grossAmount: 32414,
  taxes: {
    taxSplit: [
      { taxPerc: 2.5, taxAmount: 810.35 },
      { taxPerc: 2.5, taxAmount: 810.35 },
      { taxPerc: 5, taxAmount: 1620.7 },
    ],
  },
  netAmount: 36055.4,
};

console.log("dsfsf");
generateAndUploadInvoice(invoiceData)
  .then((data) => {
    console.log(data);
  })
  .catch((error) => {
    console.error(error);
  });



