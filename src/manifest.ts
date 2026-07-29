import type { Course } from "./types.js";
import { makeIdentifier, xmlEscape } from "./util.js";

export function createManifest(course: Course, files: string[]): string {
  const manifestId = makeIdentifier("MANIFEST", course.id);
  const organizationId = makeIdentifier("ORG", course.id);
  const itemId = makeIdentifier("ITEM", course.id);
  const resourceId = makeIdentifier("RESOURCE", course.id);
  const fileEntries = files
    .filter((file) => file !== "imsmanifest.xml")
    .sort()
    .map((file) => `      <file href="${xmlEscape(file)}"/>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${manifestId}"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:lom="http://www.imsglobal.org/xsd/imsmd_rootv1p2p1">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
    <lom:lom>
      <lom:general>
        <lom:title><lom:langstring xml:lang="${xmlEscape(course.language ?? "en")}">${xmlEscape(course.title)}</lom:langstring></lom:title>
        ${course.description ? `<lom:description><lom:langstring xml:lang="${xmlEscape(course.language ?? "en")}">${xmlEscape(course.description)}</lom:langstring></lom:description>` : ""}
      </lom:general>
    </lom:lom>
  </metadata>
  <organizations default="${organizationId}">
    <organization identifier="${organizationId}">
      <title>${xmlEscape(course.title)}</title>
      <item identifier="${itemId}" identifierref="${resourceId}">
        <title>${xmlEscape(course.title)}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${resourceId}" type="webcontent" adlcp:scormtype="sco" href="index.html">
${fileEntries}
    </resource>
  </resources>
</manifest>
`;
}
