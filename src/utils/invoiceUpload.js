import fs from "fs";
import PDFDocument from "pdfkit";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { fileURLToPath } from "url";

// Configuration
const COLORS = {
  GREEN: "#58AC64",
  BLACK: "#000000",
  GRAY: "#444444",
  HR_COLOR: "#aaaaaa",
};

const FONTS = {
  REGULAR: "Helvetica",
  BOLD: "Helvetica-Bold",
};

// Cloudinary setup -- remove env keys from here
const setupCloudinary = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dxxqpchgb",
    api_key: process.env.CLOUDINARY_API_KEY || "685724243457544",
    api_secret:
      process.env.CLOUDINARY_API_SECRET || "y_w_JPDLaXN59gihOP1kx1pUkMI",
  });
};

// Helper functions
const generateHr = (doc, y) => {
  doc
    .strokeColor(COLORS.HR_COLOR)
    .lineWidth(1)
    .moveTo(20, y)
    .lineTo(580, y)
    .stroke();
};

const generateTableRow = (
  doc,
  y,
  item,
  description,
  quantity,
  unitPrice,
  lineTotal
) => {
  doc
    .text(item, 25, y)
    .text(description, 120, y)
    .text(quantity, 260, y, { width: 110, align: "right" })
    .text(unitPrice, 390, y, { width: 100, align: "right" })
    .text(lineTotal, 500, y, { align: "right" });
};

// Invoice sections
const generateHeader = (doc, invoice) => {
  doc
    .fontSize(20)
    .text("Invoice", 20, 20)
    .fillColor(COLORS.GRAY)
    .fontSize(10)
    .text(`${invoice.invoiceNumber}`, 20, 39);

  doc.image("./public/AxcesWhiteBgLogo.jpg", 520, 18, {
    width: 40,
    height: 40,
  });

  generateHr(doc, 60);
  doc.moveDown();
};

const generateCustomerInformation = (doc, invoice) => {
  const { userInfo } = invoice;
  let yPosition = 80;

  // Company Information
  doc
    .fontSize(15)
    .font(FONTS.BOLD)
    .fillColor(COLORS.GREEN)
    .text("Sold by", 20, yPosition)
    .fillColor(COLORS.BLACK)
    .fontSize(10)
    .text("Axces Landspaces Private Limited", 20, yPosition + 18)
    .font(FONTS.REGULAR);

  // Company Address
  const companyAddress = [
    "Address: 6/392 First Floor, Doongar Mohalla",
    "Shahdara, Delhi",
    "110032",
    "GSTIN: 07ABACA5590K1ZG",
    "CIN: U68200DL2024PTC430024",
    "PAN: ABACA5590K",
    "Phone: +91-8802607429",
  ];

  let addressY = yPosition + 50;
  companyAddress.forEach((line) => {
    doc.text(line, 20, addressY);
    addressY += 15;
  });

  // Invoice Details
  doc
    .text("Original for recipient", 480, yPosition)
    .font(FONTS.BOLD)
    .fontSize(19)
    .text("TAX INVOICE", 453, yPosition + 22)
    .fontSize(15)
    .fillColor(COLORS.GREEN)
    .text("INVOICE", 510, yPosition + 45)
    .font(FONTS.REGULAR)
    .fillColor(COLORS.BLACK)
    .fontSize(10)
    .text(invoice.invoiceNumber, 433, yPosition + 65)
    .font(FONTS.BOLD)
    .fontSize(15)
    .fillColor(COLORS.GREEN)
    .text("DATE", 530, yPosition + 85)
    .font(FONTS.REGULAR)
    .fillColor(COLORS.BLACK)
    .fontSize(10)
    .text(invoice.invoiceDate, 517, yPosition + 105);

  // Customer Information
  const customerY = yPosition + 170;
  doc
    .fontSize(15)
    .font(FONTS.BOLD)
    .fillColor(COLORS.GREEN)
    .text("Customer Address", 20, customerY)
    .fillColor(COLORS.BLACK)
    .fontSize(10)
    .text(userInfo.name, 20, customerY + 20)
    .text(userInfo.email, 20, customerY + 40)
    .text(userInfo.number, 20, customerY + 60)
    .text("GSTIN: UNREGISTERED", 20, customerY + 80)
    .text("Place of supply: Delhi(07)", 20, customerY + 100);

  doc.moveDown();
};

// const generateInvoiceTable = (doc, invoice) => {
//   const tableTop = 350;

//   // Table Header
//   doc.font(FONTS.BOLD).fontSize(15).fillColor(COLORS.GREEN);

//   generateTableRow(
//     doc,
//     tableTop,
//     "Item",
//     "Quantity",
//     "Rate (INR)",
//     "Amount (INR)"
//   );

//   generateHr(doc, tableTop + 20);
//   doc.font(FONTS.REGULAR).fillColor(COLORS.BLACK);

//   // Table Content
//   let position = tableTop + 30;
//   generateTableRow(
//     doc,
//     position,
//     "Coins",
//     invoice.quantity,
//     invoice.rate,
//     invoice.grossAmount
//   );

//   // Totals
//   position += 27;
//   generateTableRow(
//     doc,
//     position,
//     "Net Total",
//     "",
//     invoice.quantity,
//     "",
//     invoice.grossAmount
//   );

//   // Taxes
//   invoice.taxes.taxSplit.forEach((tax, index) => {
//     position += 30;
//     generateTableRow(
//       doc,
//       position,
//       ["CGST", "SGST", "IGST"][index],
//       "",
//       "",
//       `${tax.taxPerc}%`,
//       tax.taxAmount
//     );
//   });

//   generateHr(doc, position + 20);
//   position += 30;
//   generateTableRow(doc, position, "Total", "", "", "", invoice.netAmount);
// };

const generateInvoiceTable = (doc, invoice) => {
  const tableTop = 380;

  // Table Header
  doc.font(FONTS.BOLD).fontSize(15).fillColor(COLORS.GREEN);

  generateTableRow(
    doc,
    tableTop,
    "Item",
    "Description",
    "Quantity",
    "HSN Code",
    "Amount"
  );

  generateHr(doc, tableTop + 20);
  doc.font(FONTS.REGULAR).fillColor(COLORS.BLACK);

  // Table Content
  let position = tableTop + 30;
  generateTableRow(
    doc,
    position,
    "Coins",
    invoice.description,
    invoice.quantity,
    "999799",
    invoice.grossAmount
  );

  // Totals
  position += 27;
  generateTableRow(
    doc,
    position,
    "Net Total",
    "",
    invoice.quantity,
    "",
    invoice.grossAmount
  );

  // Taxes
  invoice.taxes.taxSplit.forEach((tax, index) => {
    position += 30;
    generateTableRow(
      doc,
      position,
      ["CGST", "SGST"][index],
      "",
      "",
      `${tax.taxPerc}%`,
      tax.taxAmount
    );
  });

  generateHr(doc, position + 20);
  position += 30;
  generateTableRow(doc, position, "Total", "", "", "", invoice.netAmount);
};

const generateFooter = (doc) => {
  const footerY = 650;

  // Terms & Conditions
  doc
    .fontSize(15)
    .font(FONTS.BOLD)
    .fillColor(COLORS.GREEN)
    .text("Terms & Conditions :-", 20, footerY)
    .fillColor(COLORS.BLACK)
    .fontSize(10)
    .font(FONTS.REGULAR);

  const terms = [
    "1. Coins once credited will not be returned.",
    "2. Any dispute shall be subject to Delhi jurisdiction.",
    "3. Additional Payment gateway surcharge might be levied by the partner.",
  ];

  let termsY = footerY + 20;
  terms.forEach((term) => {
    doc.text(term, 23, termsY);
    termsY += 15;
  });

  // Footer text
  generateHr(doc, 760);
  doc
    .fontSize(10)
    .text(
      "This is computer generated invoice. If you have any questions concerning this invoice, contact",
      50,
      770,
      { align: "center", width: 500 }
    )
    .fillColor("blue")
    .text("axces.customercare@gmail.com", 50, 790, {
      align: "center",
      width: 500,
    });
};

const debugLog = (message, ...args) => {
  console.log(`[DEBUG] ${message}`, ...args);
};

// Main functions
const createInvoice = async (invoiceData, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 20 });
      const writeStream = fs.createWriteStream(filePath);

      // Add more comprehensive error logging
      writeStream.on("error", (err) => {
        debugLog("Write Stream Error:", err);
        reject(err);
      });

      doc.on("error", (err) => {
        debugLog("PDF Document Error:", err);
        reject(err);
      });

      // Validate invoice data before generation
      if (!invoiceData || !invoiceData.invoiceNumber) {
        const validationError = new Error("Invalid invoice data");
        debugLog("Validation Error:", validationError);
        reject(validationError);
        return;
      }

      doc.pipe(writeStream);

      generateHeader(doc, invoiceData);
      generateCustomerInformation(doc, invoiceData);
      generateInvoiceTable(doc, invoiceData);
      generateFooter(doc);

      doc.fontSize(10);
      doc.text(" ", { continued: true }); // Add a tiny space to force rendering

      doc.end();

      writeStream.on("finish", () => {
        const stats = fs.statSync(filePath);
        debugLog("PDF File Stats:", {
          size: stats.size,
          path: filePath,
        });

        if (stats.size === 0) {
          const sizeError = new Error("Generated PDF is empty");
          debugLog("Empty PDF Error:", sizeError);
          reject(sizeError);
        } else {
          resolve(filePath);
        }
      });
      writeStream.on("error", reject);
    } catch (error) {
      debugLog("Overall PDF Generation Error:", error);
      reject(error);
    }
  });
};

const uploadToCloudinary = async (filePath) => {
  try {
    if (!filePath) {
      throw new Error("No file path provided");
    }
    const normalizedPath = path.normalize(filePath);

    try {
      fs.accessSync(normalizedPath, fs.constants.R_OK);
    } catch (error) {
      throw new Error(`Cannot read file: ${normalizedPath}`);
    }

    // Verify file exists and has content before upload
    const stats = fs.statSync(normalizedPath);

    console.log("File Details:", {
      path: normalizedPath,
      size: stats.size + " bytes",
      isFile: stats.isFile(),
      lastModified: stats.mtime,
    });

    if (stats.size === 0) {
      throw new Error("Cannot upload empty file");
    }

    setupCloudinary();
    console.log({ filePath });

    const response = await cloudinary.uploader.upload(normalizedPath, {
      resource_type: "auto", // Use 'raw' for PDFs
      folder: "invoices",
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      tags: ["invoice", "pdf"],
    });

    console.log({ response });
    console.log("Cloudinary Upload Complete:", {
      url: response.url,
      publicId: response.public_id,
      format: response.format,
      bytes: response.bytes,
      resourceType: response.resource_type,
      secureUrl: response.secure_url,
    });

    return response.url;
  } catch (error) {
    console.error("Cloudinary Upload Error:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });

    throw new Error(`Cloudinary upload failed: ${error.message}`);
  } finally {
    console.log("cleanup");
    // Clean up the local file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const generateAndUploadInvoice = async (invoiceData) => {
  try {
    const filename = `invoice_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, "assets", filename);

    // Ensure assets directory exists
    const assetsDir = path.join(__dirname, "assets");
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Create invoice PDF
    const generateFilePath = await createInvoice(invoiceData, filePath);
    // Upload to Cloudinary
    const cloudinaryUrl = await uploadToCloudinary(generateFilePath);

    return {
      success: true,
      url: cloudinaryUrl,
    };
  } catch (error) {
    debugLog("Overall Generation and upload error", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

const invoiceData = {
  invoiceNumber: "INV001",
  paymentId: "PAY001",
  invoiceDate: "2023-03-10",
  quantity: 50,
  rate: 1,
  description: "Property Post Charges",
  grossAmount: 41,
  taxes: {
    taxSplit: [
      { taxPerc: 9, taxAmount: 4.5 },
      { taxPerc: 9, taxAmount: 4.5 },
    ],
  },
  netAmount: 50,
  userInfo: {
    name: "Pawan Singh Dogra",
    email: "contact@pawan.com",
    number: "+91-9876543210",
  },
};

// // console.log("dsfsf");
// generateAndUploadInvoice(invoiceData)
//   .then((data) => {
//     console.log({ data });
//   })
//   .catch((error) => {
//     console.error(error);
//   });
