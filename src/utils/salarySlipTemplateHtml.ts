import {
  replaceTemplateTokens,
  type TemplateImage,
} from '@/utils/documentTemplateUtils';

export type SalarySlipHtmlTemplate = {
  id?: string;
  htmlContent?: string;
  images?: TemplateImage[];
};

export type SalarySlipTemplateData = {
  companyName: string;
  companyAddress: string;
  companyPhone?: string;
  companyEmail?: string;
  monthLabel: string;
  employeeId: string;
  paymentStatus: string;
  paidDate: string;
  employeeName: string;
  designation: string;
  department: string;
  dateOfJoining: string;
  employeePhone: string;
  employeeEmail: string;
  basicSalary: string;
  hra: string;
  travelAllowance: string;
  incentives: string;
  totalEarnings: string;
  festivalAdvance: string;
  generalAdvance: string;
  deductions: string;
  totalDeductions: string;
  netSalary: string;
  remarks: string;
};

const LOGO_PLACEHOLDER_TOKEN = '{{LOGO_PLACEHOLDER}}';

function mergeTemplateImagesWithDefaultLogo(
  images: TemplateImage[] | undefined,
  publicOrigin?: string
): TemplateImage[] {
  const list = [...(images ?? [])];
  const hasLogo = list.some(
    (im) => im.placeholder === LOGO_PLACEHOLDER_TOKEN && String(im.url ?? '').trim() !== ''
  );
  if (!hasLogo) {
    const url =
      publicOrigin && publicOrigin.trim()
        ? `${publicOrigin.replace(/\/$/, '')}/images/logohope.svg`
        : '/images/logohope.svg';
    list.push({ placeholder: LOGO_PLACEHOLDER_TOKEN, url });
  }
  return list;
}

export function buildSalarySlipHtmlString(
  template: SalarySlipHtmlTemplate,
  data: SalarySlipTemplateData,
  opts?: { logoPublicOrigin?: string }
): string {
  const images = mergeTemplateImagesWithDefaultLogo(template.images, opts?.logoPublicOrigin);
  return replaceTemplateTokens(
    template.htmlContent || '',
    {
      COMPANY_NAME: data.companyName,
      COMPANY_ADDRESS: data.companyAddress,
      COMPANY_PHONE: data.companyPhone || '',
      COMPANY_EMAIL: data.companyEmail || '',
      SALARY_MONTH: data.monthLabel,
      EMPLOYEE_ID: data.employeeId,
      PAYMENT_STATUS: data.paymentStatus,
      PAID_DATE: data.paidDate,
      EMPLOYEE_NAME: data.employeeName,
      DESIGNATION: data.designation,
      DEPARTMENT: data.department,
      DATE_OF_JOINING: data.dateOfJoining,
      EMPLOYEE_PHONE: data.employeePhone,
      EMPLOYEE_EMAIL: data.employeeEmail,
      BASIC_SALARY: data.basicSalary,
      HRA: data.hra,
      TRAVEL_ALLOWANCE: data.travelAllowance,
      INCENTIVES: data.incentives,
      TOTAL_EARNINGS: data.totalEarnings,
      FESTIVAL_ADVANCE: data.festivalAdvance,
      GENERAL_ADVANCE: data.generalAdvance,
      DEDUCTIONS: data.deductions,
      TOTAL_DEDUCTIONS: data.totalDeductions,
      NET_SALARY: data.netSalary,
      REMARKS: data.remarks,
      LOGO_PLACEHOLDER: '',
      SIGNATURE_PLACEHOLDER: '',
    },
    images
  );
}
