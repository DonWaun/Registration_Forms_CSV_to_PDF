import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import "./styles.css";

const DEFAULT_MAPPING = {
  Address: "Address",
  City: "City",
  State: "State",
  Grade: "Grade",
  Gender: "Gender",
  Birthdate: "Birthdate",
  Parish: "Parish",
  Relationship: "Relationship to Participant",
  Date: "Date",
  Date_2: "Date (2)",
  Group: "Group #",
  Date_3: "Date (3)",
  Relationship_2: "Relationship",
  Date_4: "Date (4)",
  MedsDate_5: "Date (5)",
  Allergies: "Allergies",
  Date_8: "Date (8)",
  Date_9: "Date (9)",
  Date_10: "Date (10)",
  Date_11: "Date (11)",
  ParentGuardiansName: "Parent/Guardian's Name",
  ZipCode: "Zip Code",
  ParticipantsPhone: "Participant's Phone Number",
  ParticipantsEmail: "Participant's Email",
  ParentGuardiansEmail: "Parent/Guardian's Email",
  ParentSignature1: "Parent/Guardian's Signature",
  ParentGuardiansName1: "Parent/Guardian's Name",
  EventName: "event_name",
  OtherParentGuardiansName: "Other Parent/Guardian",
  ParentSignature2: "Parent/Guardian's Signature (2)",
  HealthPlanCarrier: "Health Plan Carrier",
  MemberID: "Member ID",
  SecondaryEmergencyContactName: "Secondary Emergency Contact Name",
  SecondaryEmergencyPhone: "Emergency Phone",
  MedicationInstructions: "Medications List & Instructions",
  MedsParentGuardiansName: "Parent/Guardian's Name",
  YESOTCDate_6: "Date (6)",
  NOOTCDate_7: "Date (7)",
  DietaryNeeds: "Dietary Needs",
  PhysicalLimitations: "Physical Limitations",
  SpecialMedicalConditions: "Special Medical Conditions",
  ParentSignature3: "Parent/Guardian's Signature (3)",
  ParentSignature4: "Parent/Guardian's Signature (4)",
  ParentSignature5: "Parent/Guardian's Signature (5)",
  YESOTCParentGuardiansName: "Parent/Guardian's Name",
  YESOTCParentSignature6: "Parent/Guardian's Signature (6)",
  NOOTCParentGuardiansName: "Parent/Guardian's Name",
  NOOTCParentSignature7: "Parent/Guardian's Signature (7)",
  ParticipantsName: "Participant's Name",
  ParticipantSignature: "Participant's Signature",
  ParentSignature8: "Parent/Guardian's Signature (8)",
  EventDate: "event_date",
  ParticipantSignature2: "Participant's Signature (2)",
  ParentSignature9: "Parent/Guardian's Signature (9)",
  EmergencyPhoneNumber: "Emergency Phone Number",
};

export default function App() {
  const [dataRows, setDataRows] = useState([]);
  const [dataHeaders, setDataHeaders] = useState([]);
  const [pdfBytes, setPdfBytes] = useState(null);
  const [pdfFields, setPdfFields] = useState([]);

  const [mapping, setMapping] = useState(() => {
    const saved = localStorage.getItem("pdf_mapping");
    return saved ? JSON.parse(saved) : DEFAULT_MAPPING;
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [successCount, setSuccessCount] = useState(null);

  const [dataError, setDataError] = useState("");
  const [pdfError, setPdfError] = useState("");

  const onDataDrop = (acceptedFiles, rejectedFiles) => {
    setDataError("");
    if (rejectedFiles && rejectedFiles.length > 0) {
      setDataError("Wrong file type uploaded. The correct file type is CSV.");
      return;
    }
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.match(/\.(csv|xls|xlsx)$/i)) {
      setDataError("Wrong file type uploaded. The correct file type is CSV.");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length > 0) {
          const headers = Object.keys(results.data[0]);
          setDataHeaders(headers);

          const testRow = {};
          headers.forEach((h) => {
            testRow[h] = "Test";
          });

          setDataRows([testRow, ...results.data]);
          setSuccessCount(null);
        }
      },
      error: (err) => {
        setDataError("Error parsing file. Please ensure it is a valid CSV.");
      },
    });
  };

  const onPdfDrop = async (acceptedFiles, rejectedFiles) => {
    setPdfError("");
    if (rejectedFiles && rejectedFiles.length > 0) {
      setPdfError("Wrong file type uploaded. The correct file type is PDF.");
      return;
    }
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.match(/\.pdf$/i)) {
      setPdfError("Wrong file type uploaded. The correct file type is PDF.");
      return;
    }

    try {
      const bytes = await file.arrayBuffer();
      setPdfBytes(bytes);

      const pdfDoc = await PDFDocument.load(bytes);
      const form = pdfDoc.getForm();
      const fields = form.getFields().map((f) => f.getName());
      setPdfFields(fields);
      setSuccessCount(null);
    } catch (err) {
      setPdfError(
        "Could not read PDF template. Please ensure it is a valid PDF."
      );
    }
  };

  const { getRootProps: getDataProps, getInputProps: getDataInput } =
    useDropzone({
      onDrop: onDataDrop,
      accept: {
        "text/csv": [".csv"],
        "application/vnd.ms-excel": [".xls"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
          ".xlsx",
        ],
      },
      maxFiles: 1,
    });

  const { getRootProps: getPdfProps, getInputProps: getPdfInput } = useDropzone(
    {
      onDrop: onPdfDrop,
      accept: { "application/pdf": [".pdf"] },
      maxFiles: 1,
    }
  );

  const handleMapChange = (pdfField, excelHeader) => {
    setMapping((prev) => {
      const updated = { ...prev, [pdfField]: excelHeader };
      localStorage.setItem("pdf_mapping", JSON.stringify(updated));
      return updated;
    });
  };

  const isUrl = (string) => {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  const unmappedFields = pdfFields.filter(
    (field) => !mapping[field] || mapping[field] === ""
  );

  const generatePDFs = async () => {
    setIsGenerating(true);
    setSuccessCount(null);
    setProgress({ current: 0, total: dataRows.length });
    const zip = new JSZip();

    const formatDateVal = (val) => {
      if (!val) return "";
      if (val instanceof Date && !isNaN(val.getTime())) {
        const month = String(val.getUTCMonth() + 1).padStart(2, "0");
        const day = String(val.getUTCDate()).padStart(2, "0");
        const year = val.getUTCFullYear();
        return `${month}/${day}/${year}`;
      }
      if (!isNaN(val) && Number(val) > 30000 && Number(val) < 60000) {
        const utcDays = Math.floor(Number(val) - 25569);
        const utcValue = utcDays * 86400 * 1000;
        const dateInfo = new Date(utcValue);
        const month = String(dateInfo.getUTCMonth() + 1).padStart(2, "0");
        const day = String(dateInfo.getUTCDate()).padStart(2, "0");
        const year = dateInfo.getUTCFullYear();
        return `${month}/${day}/${year}`;
      }
      const stringVal = String(val).trim();
      const parsedDate = new Date(stringVal);
      if (!isNaN(parsedDate.getTime())) {
        const month = String(parsedDate.getUTCMonth() + 1).padStart(2, "0");
        const day = String(parsedDate.getUTCDate()).padStart(2, "0");
        const year = parsedDate.getUTCFullYear();
        return `${month}/${day}/${year}`;
      }
      return stringVal;
    };

    const formatZipVal = (val) => {
      if (!val) return "";
      let zipStr = String(val).trim();
      if (zipStr.includes(".")) {
        zipStr = zipStr.split(".")[0];
      }
      return zipStr.padStart(5, "0");
    };

    const formatPhoneVal = (val) => {
      if (!val) return "";
      const digits = String(val).replace(/\D/g, "");
      if (digits.length === 11 && digits.startsWith("1")) {
        return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(
          7
        )}`;
      } else if (digits.length === 10) {
        return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
          6
        )}`;
      } else if (digits.length > 11) {
        const country = digits.slice(0, digits.length - 10);
        const area = digits.slice(-10, -7);
        const prefix = digits.slice(-7, -4);
        const line = digits.slice(-4);
        return `+${country} (${area}) ${prefix}-${line}`;
      }
      return String(val).trim();
    };

    const nameCounts = {};

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const form = pdfDoc.getForm();

      const yesSigHeader = mapping["YESOTCParentSignature6"];
      const noSigHeader = mapping["NOOTCParentSignature7"];
      const medInstructionsHeader = mapping["MedicationInstructions"];

      const yesSigVal = yesSigHeader
        ? String(row[yesSigHeader] || "").trim()
        : "";
      const noSigVal = noSigHeader ? String(row[noSigHeader] || "").trim() : "";
      const medInstructionsVal = medInstructionsHeader
        ? String(row[medInstructionsHeader] || "").trim()
        : "";

      const activeMapping = { ...mapping };
      const fieldsToBlank = [];

      if (yesSigVal !== "") {
        ["NOOTCParentGuardiansName", "NOOTCDate_7"].forEach((f) => {
          delete activeMapping[f];
          fieldsToBlank.push(f);
        });
      }

      if (noSigVal !== "") {
        ["YESOTCParentGuardiansName", "YESOTCDate_6"].forEach((f) => {
          delete activeMapping[f];
          fieldsToBlank.push(f);
        });
      }

      if (medInstructionsVal === "") {
        ["MedsParentGuardiansName", "MedsDate_5"].forEach((f) => {
          delete activeMapping[f];
          fieldsToBlank.push(f);
        });
      }

      delete activeMapping["MedicationInstructions"];
      if (medInstructionsVal !== "") {
        try {
          const field = form.getField("MedicationInstructions");
          const widgets = field.acroField.getWidgets();
          if (widgets.length > 0) {
            const widget = widgets[0];
            const rect = widget.getRectangle();
            const rawPageRef = widget.P();
            const page =
              pdfDoc.getPages().find((p) => p.ref === rawPageRef) ||
              pdfDoc.getPages()[0];

            const maxLineWidth = rect.width - 4;
            const charWidth = 8 * 0.5;
            const maxCharsPerLine = Math.floor(maxLineWidth / charWidth);
            const words = medInstructionsVal.split(/\s+/);

            let linesCount = 0;
            let currentLineLen = 0;
            for (const word of words) {
              if (currentLineLen + word.length + 1 <= maxCharsPerLine) {
                currentLineLen += word.length + 1;
              } else {
                linesCount++;
                currentLineLen = word.length;
              }
            }
            if (currentLineLen > 0) linesCount++;

            if (linesCount <= 3) {
              form.removeField(field);
              let startY = rect.y + rect.height - 10;
              let currentLine = "";
              for (const word of words) {
                if (
                  (currentLine + " " + word).trim().length <= maxCharsPerLine
                ) {
                  currentLine = currentLine ? currentLine + " " + word : word;
                } else {
                  page.drawText(currentLine, {
                    x: rect.x + 2,
                    y: startY,
                    size: 8,
                    color: rgb(0, 0, 0),
                  });
                  startY -= 10;
                  currentLine = word;
                }
              }
              if (currentLine) {
                page.drawText(currentLine, {
                  x: rect.x + 2,
                  y: startY,
                  size: 8,
                  color: rgb(0, 0, 0),
                });
              }
            } else {
              const textField = form.getTextField("MedicationInstructions");
              textField.setText(
                "See attached page for medication instructions"
              );

              const participantName =
                row["Participant's Name"] || "Participant";
              const newPage = pdfDoc.addPage([612, 792]);
              const helveticaFont = await pdfDoc.embedFont(
                StandardFonts.Helvetica
              );
              const helveticaBold = await pdfDoc.embedFont(
                StandardFonts.HelveticaBold
              );

              newPage.drawText("Attached Medication Instructions & Details", {
                x: 50,
                y: 730,
                size: 16,
                font: helveticaBold,
                color: rgb(0, 0, 0),
              });

              newPage.drawText(`Participant Name: ${participantName}`, {
                x: 50,
                y: 700,
                size: 12,
                font: helveticaBold,
                color: rgb(0.2, 0.2, 0.2),
              });

              const pageMaxWidth = 512;
              const pageCharLimit = Math.floor(pageMaxWidth / (10 * 0.5));
              const pageWords = medInstructionsVal.split(/\s+/);
              let pageLines = [];
              let pageLine = "";

              for (const word of pageWords) {
                if ((pageLine + " " + word).trim().length <= pageCharLimit) {
                  pageLine = pageLine ? pageLine + " " + word : word;
                } else {
                  if (pageLine) pageLines.push(pageLine);
                  pageLine = word;
                }
              }
              if (pageLine) pageLines.push(pageLine);

              let cursorY = 660;
              for (const line of pageLines) {
                if (cursorY < 50) break;
                newPage.drawText(line, {
                  x: 50,
                  y: cursorY,
                  size: 10,
                  font: helveticaFont,
                  color: rgb(0, 0, 0),
                });
                cursorY -= 16;
              }
            }
          }
        } catch (e) {
          console.warn(
            "Could not process MedicationInstructions overflow handling:",
            e
          );
        }
      }

      for (const pdfField of Object.keys(activeMapping)) {
        const excelHeader = activeMapping[pdfField];
        const val = row[excelHeader];

        if (val === undefined || val === null || val === "") continue;

        const valString = String(val).trim();

        if (isUrl(valString)) {
          try {
            const imageRes = await fetch(valString);
            const imageBytes = await imageRes.arrayBuffer();

            let image;
            try {
              image = await pdfDoc.embedPng(imageBytes);
            } catch (pngErr) {
              image = await pdfDoc.embedJpg(imageBytes);
            }

            try {
              const field = form.getField(pdfField);
              const widgets = field.acroField.getWidgets();

              if (widgets.length > 0) {
                const widget = widgets[0];
                const rect = widget.getRectangle();

                const rawPageRef = widget.P();
                const page =
                  pdfDoc.getPages().find((p) => p.ref === rawPageRef) ||
                  pdfDoc.getPages()[0];

                const maxSigWidth = rect.width;
                const targetMaxHeight = 45;

                const scaleX = maxSigWidth / image.width;
                const scaleY = targetMaxHeight / image.height;
                const scale = Math.min(scaleX, scaleY);

                const finalWidth = image.width * scale;
                const finalHeight = image.height * scale;

                const offsetX = (rect.width - finalWidth) / 2;
                const offsetY = (rect.height - finalHeight) / 2;

                page.drawImage(image, {
                  x: rect.x + offsetX,
                  y: rect.y + offsetY,
                  width: finalWidth,
                  height: finalHeight,
                });
              }
            } catch (fieldErr) {
              console.warn(
                `Could not place image signature on field ${pdfField}`,
                fieldErr
              );
            }
          } catch (imgError) {
            console.error(
              `Could not fetch or render signature image from ${valString}:`,
              imgError
            );
          }
        } else {
          try {
            const field = form.getTextField(pdfField);

            let formattedVal = String(val);
            const lowerField = pdfField.toLowerCase();

            if (lowerField.includes("date") || lowerField.includes("birth")) {
              formattedVal = formatDateVal(val);
            } else if (lowerField.includes("zip")) {
              formattedVal = formatZipVal(val);
            } else if (lowerField.includes("phone")) {
              formattedVal = formatPhoneVal(val);
            } else {
              formattedVal = String(val).trim();
            }

            field.setText(formattedVal);
          } catch (e) {
            console.warn(`Could not set text for field ${pdfField}.`, e);
          }
        }
      }

      for (const fieldName of fieldsToBlank) {
        try {
          const field = form.getTextField(fieldName);
          field.setText("");
        } catch (e) {
          console.warn(`Could not blank field ${fieldName}:`, e);
        }
      }

      const pdfBytesFilled = await pdfDoc.save();

      const rawParticipantName =
        row["Participant's Name"] || `Participant_${i + 1}`;
      let sanitizedName = String(rawParticipantName)
        .replace(/[^a-z0-9]/gi, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");

      if (nameCounts[sanitizedName] !== undefined) {
        nameCounts[sanitizedName] += 1;
        sanitizedName = `${sanitizedName}_${nameCounts[sanitizedName]}`;
      } else {
        nameCounts[sanitizedName] = 1;
      }

      zip.file(`${sanitizedName}.pdf`, pdfBytesFilled);
      setProgress({ current: i + 1, total: dataRows.length });
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, "Completed_PDFs.zip");
    setIsGenerating(false);
    setSuccessCount(dataRows.length);
  };

  return (
    <div
      className="App"
      style={{
        padding: "20px",
        fontFamily: "sans-serif",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <h1>PDF Automation Tool</h1>

      <div
        {...getDataProps()}
        style={{
          border: "2px dashed #ccc",
          padding: "20px",
          marginBottom: "10px",
          cursor: "pointer",
          borderRadius: "6px",
        }}
      >
        <input {...getDataInput()} />
        <p>
          {dataRows.length > 0
            ? `Tally CSV Loaded (${dataRows.length - 1} submissions + Test row)`
            : "Drag & drop Tally CSV export here, or click to select"}
        </p>
      </div>
      {dataError && (
        <div
          style={{
            color: "#d9534f",
            fontSize: "14px",
            marginBottom: "15px",
            fontWeight: "bold",
          }}
        >
          ⚠️ {dataError}
        </div>
      )}

      <div
        {...getPdfProps()}
        style={{
          border: "2px dashed #ccc",
          padding: "20px",
          marginBottom: "10px",
          cursor: "pointer",
          borderRadius: "6px",
        }}
      >
        <input {...getPdfInput()} />
        <p>
          {pdfBytes
            ? "PDF Template Loaded"
            : "Drag & drop PDF template here, or click to select"}
        </p>
      </div>
      {pdfError && (
        <div
          style={{
            color: "#d9534f",
            fontSize: "14px",
            marginBottom: "15px",
            fontWeight: "bold",
          }}
        >
          ⚠️ {pdfError}
        </div>
      )}

      {pdfFields.length > 0 && dataHeaders.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3>Map PDF Fields to CSV Columns</h3>
          {pdfFields.map((field) => (
            <div
              key={field}
              style={{
                marginBottom: "10px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <label
                style={{
                  marginRight: "10px",
                  fontWeight: "bold",
                  width: "250px",
                }}
              >
                {field}:
              </label>
              <select
                value={mapping[field] || ""}
                onChange={(e) => handleMapChange(field, e.target.value)}
                style={{ flex: 1, padding: "5px" }}
              >
                <option value="">-- Select Column --</option>
                {dataHeaders.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {pdfBytes && dataRows.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          {unmappedFields.length > 0 && (
            <div
              style={{
                background: "#fff3cd",
                border: "1px solid #ffeeba",
                color: "#856404",
                padding: "12px",
                borderRadius: "6px",
                marginBottom: "15px",
              }}
            >
              <strong>⚠️ Warning:</strong> The following {unmappedFields.length}{" "}
              PDF field(s) are currently unmapped:
              <ul
                style={{
                  margin: "8px 0 0 20px",
                  padding: 0,
                  lineHeight: "1.6",
                }}
              >
                {unmappedFields.map((f) => (
                  <li key={f} style={{ marginBottom: "4px" }}>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isGenerating && (
            <div style={{ marginBottom: "15px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "5px",
                  fontWeight: "bold",
                }}
              >
                <span>Generating PDFs...</span>
                <span>
                  {progress.current} / {progress.total} (
                  {Math.round((progress.current / progress.total) * 100)}%)
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  background: "#e0e0e0",
                  borderRadius: "4px",
                  height: "16px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                    background: "#007bff",
                    height: "100%",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
            </div>
          )}

          {successCount !== null && !isGenerating && (
            <div
              style={{
                background: "#d4edda",
                border: "1px solid #c3e6cb",
                color: "#155724",
                padding: "12px",
                borderRadius: "6px",
                marginBottom: "15px",
                fontWeight: "bold",
              }}
            >
              ✅ Successfully generated and filled {successCount} PDF(s)! The
              ZIP file has been downloaded.
            </div>
          )}

          <button
            onClick={generatePDFs}
            disabled={isGenerating}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              cursor: isGenerating ? "not-allowed" : "pointer",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
            }}
          >
            {isGenerating ? "Generating PDFs..." : "Generate & Download ZIP"}
          </button>
        </div>
      )}
    </div>
  );
}
