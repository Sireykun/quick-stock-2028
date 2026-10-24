export const CUSTOM_ROOM_PREFIX = 'Room: ';
export const OFFICE_DEPARTMENT_PREFIX = 'Office: ';

export function isOfficeDepartment(sheetName: string) {
  return sheetName.startsWith(OFFICE_DEPARTMENT_PREFIX);
}

export function roomLabel(sheetName: string) {
  if (sheetName.startsWith(CUSTOM_ROOM_PREFIX)) return sheetName.slice(CUSTOM_ROOM_PREFIX.length);
  if (isOfficeDepartment(sheetName)) return sheetName.slice(OFFICE_DEPARTMENT_PREFIX.length);
  return sheetName;
}

export function isOfficeOrCustomRoom(sheetName: string) {
  return sheetName.toLocaleLowerCase() === 'office' || sheetName.startsWith(CUSTOM_ROOM_PREFIX) || isOfficeDepartment(sheetName);
}
