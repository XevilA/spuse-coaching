import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export const exportToPDF = (data: any[], title: string, columns: string[], headers: string[]) => {
  const doc = new jsPDF();
  
  // Add Thai font support
  doc.setFont('helvetica');
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  
  const tableData = data.map(item => 
    columns.map(col => {
      const value = col.split('.').reduce((obj, key) => obj?.[key], item);
      return value || '-';
    })
  );

  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 25,
    styles: { font: 'helvetica', fontSize: 10 },
    headStyles: { fillColor: [66, 139, 202] },
  });

  doc.save(`${title}-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportToExcel = (data: any[], filename: string, sheetName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportToCSV = (data: any[], filename: string) => {
  const headers = Object.keys(data[0] || {});
  const csv = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};
