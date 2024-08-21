import { Table } from "ka-table";
import { DataType, EditingMode, SortingMode } from "ka-table/enums";
import "ka-table/style.css";

function CsvDataTable({ data, table }) {
  if (data === null || data.length === 0) {
    return null;
  }

  const columns = Object.keys(data[0]).map((key) => ({
    key,
    title: key,
    dataType: DataType.String,
  }));

  const rows = data.map((row, index) => ({ ...row, id: index }));

  return (
    <Table
      columns={columns}
      data={rows}
      table={table}
      editingMode={EditingMode.Cell}
      rowKeyField={"id"}
      sortingMode={SortingMode.Single}
    />
  );
}

export default CsvDataTable;
