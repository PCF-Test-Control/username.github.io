/* eslint-disable */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import "datatables.net-dt/css/dataTables.dataTables.css"; // DataTables styles
import $ from "jquery"; 
import "datatables.net-dt";

import '../css/DataGridMain.css'; // Import the CSS file

//TODO: Remove these after testing
let _viewDate :  D365_View[] = [];
let _gridData : any;

interface DataTableProps {
    EntityName: string;
    UserId: string;
}

interface D365_View {
    //ViewName: ReactNode;
    ViewId: string;
    ViewName: string;
    ViewType: string;
}

// Fetch view data
async function fetchViewData(this: any, entityName: string, userId: string) {
    try {
        if (_viewDate == null || (_viewDate != null && _viewDate.length <= 0))
        {
            let flowUrlForView = 'https://prod-28.westus.logic.azure.com:443/workflows/eb5d27d1a9f344b9b2651d9d048a720b/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=X0iuCKGKSP2KpNyNRPAkFw6SyVt79MFRfIYxLHIinc8';
            
            let jsonData = {"userid": userId ,"entityname": entityName};
            const response = await fetch(flowUrlForView, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(jsonData)
            });

            if (!response.ok) {
                throw new Error(`Error calling flow: ${response.statusText}`);
            }

            const data = await response.json();
            _viewDate = data;
            return data;
        }
        else
            return _viewDate;
    } catch (error) {
        console.error("Error calling flow:", error);
        throw error;
    }
}

// Fetch entity data record
async function fetchEntityDataRecord(EntityName: string, viewId: string, viewType : string, userid : string, numRows : number, pageNum : number, customFilter : string) {
    try {
        if (_gridData == null || (_gridData != null && _gridData.length <= 0))
        {
            let flowUrlForView = 'https://prod-132.westus.logic.azure.com:443/workflows/54235fd691644a958f770df638f3878d/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=WDn_zoNHJQ7OpcLmMS_kSN3f4xANdHM_6Lny6Zhnku0';
            
            const response = await fetch(flowUrlForView, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ 'EntityName' : EntityName, 'ViewId' : viewId, 'ViewType' : viewType, 'UserId' : userid, 'NumRows' : numRows, 'PageNum' : pageNum, 'CustomFilter' : customFilter })
            });

            if (!response.ok) {
                throw new Error(`Error calling flow: ${response.statusText}`);
            }

            const data = await response.json();
            console.log("Data received from flow:", data);
            _gridData = data;
            return data;
        }
        else
            return _gridData;
    } catch (error) {
        console.error("Error calling flow:", error);
        throw error;
    }
}

async function transformEntityData(d: any[], headers: { name: string; displayname: string; attributetype: string, optionSetData?: { Label: string; value: number }[] }[]): Promise<any[]> {
    return d.map((entity: any) => {
        const row: any = {};
        headers.forEach(header => {
            const attribute = entity.Attributes.find((attr: any) => attr.Key === header.name);
            if (attribute) {
                if (header.attributetype === 'CustomerType' || header.attributetype === 'LookupType') {
                    row[header.name] = `<a href="https://org3c5b403b.crm.dynamics.com/main.aspx?pagetype=entityrecord&etn=${attribute.Value.LogicalName}&id=${attribute.Value.Id}" 
                    target="_blank">${attribute.Value.Name}</a>`; // Handle CustomerType || LookupType
                } else if (header.attributetype === 'DateTimeType' && attribute.Value) {
                    row[header.name] = new Date(attribute.Value).toLocaleDateString(); // Handle DateTimeType to show only date
                } else if (header.attributetype === 'BooleanType') {
                    row[header.name] = attribute.Value ? 'Yes' : 'No'; // Handle BooleanType
                } else if (header.attributetype === 'MoneyType') {
                    row[header.name] = new Intl.NumberFormat('en-US', { style: 'decimal' }).format(attribute.Value.Value); // Handle MoneyType
                } else if (header.attributetype === 'PicklistType' || header.attributetype === 'StateType') {
                    const option = header.optionSetData?.find(opt => opt.value === attribute.Value.Value);
                    row[header.name] = option ? option.Label : ''; // Handle PicklistType and StateType
                } else if (header.attributetype === 'MemoType') {
                    row[header.name] = `<div class="memo-type">${attribute.Value}</div>`; // Handle MemoType with wrapping
                } else if (header.name.toLowerCase().includes('email')) {
                    row[header.name] = `<a href="mailto:${attribute.Value}">${attribute.Value}</a>`; // Handle email as mailto link
                } else if (header.name.toLowerCase().includes('phone') || header.name.toLowerCase().includes('mobile')) {
                    row[header.name] = `<a href="tel:${attribute.Value}">${attribute.Value}</a>`; // Handle phone as tel link
                } else if (typeof attribute.Value === 'object' && attribute.Value !== null) {
                    row[header.name] = attribute.Value.Name; // Handle Misc Objects
                } else {
                    row[header.name] = attribute.Value;
                }
            } else {
                row[header.name] = ''; // Set empty value if attribute is missing
            }
        });
        // Add edit button column
        row['edit'] = `<a href="https://org3c5b403b.crm.dynamics.com/main.aspx?pagetype=entityrecord&etn=${entity.LogicalName}&id=${entity.Id}" target="_blank">Edit</a>`;
        return row;
    });
}


// Extract GUID from URL
// const extractGuidFromUrl = (url: string) => {
//     const match = url.match(/\(([^)]+)\)/);
//     return match ? match[1] : '';
// };

const DataTableComponent: React.FC<DataTableProps> = React.memo(({ EntityName, UserId }) => {
    const tableRef = React.useRef<HTMLTableElement>(null);
    const [data, setData] = useState<any[]>([]); 
    const [rowData, setRowData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<any[]>([]);
    //These for Drop Down
    const [viewList, setViewList] = useState<any[]>([]); 
    const [selectedView, setSelectedView] = useState<string>("");
    //For Search Textbox
    const [filterValue, setFilterValue] = useState<string>("");
    const [dataKey, setDataKey] = useState(0);

    React.useEffect(() => {
        const fetchData = async () => {
            let data;
            let headers = [];
            try {
                let viewId: string = '', viewType: string = '';
 
                //Get List of views based on entity
                let ename= 'contact' ;
                let userid= 'c3a65fc0-60a9-ef11-b8e9-00224803cf63';

                //let dataResultForView = await fetchViewData(EntityName , UserId);
                let dataResultForView = await fetchViewData(ename , userid);

                if (dataResultForView != null && dataResultForView.result != null){
                    //Convert to json
                    const viewList = JSON.parse(dataResultForView.result);
                    console.log("viewList : " +  viewList);
                    setViewList(viewList);

                    //Get View Id
                    viewId = viewList[0].ViewId;
                    //Get View Type if User Saved or Sytem Defined view
                    viewType = viewList[0].ViewType;
                    
                }

                //Get Results based on this
                const dataResult = await fetchEntityDataRecord(EntityName, viewId, viewType, userid, 50, 1, "");
                if (dataResult != null && dataResult.entitydata != null && dataResult.headerdata != null)
                {
                    //Set Grid Data
                    data = JSON.parse(dataResult.entitydata);
                    //Get Grid Header Data
                    const gridHeader = JSON.parse(dataResult.headerdata);
                    console.log("data: " + data);
                    console.log("headerdata: " + gridHeader);
                    
                    if (gridHeader != null) {
                        headers = gridHeader.map((header: { displayname: string; name: string; attributetype: string; optionSetData?: { Label: string; value: number }[] }) => ({
                            displayname: header.displayname,
                            name: header.name,
                            attributetype: header.attributetype,
                            optionSetData: header.optionSetData || null // Include optionSetData if it exists, otherwise set to null
                        }));
                        
                    }
                }

                // Transform the data
                const transformedData = await transformEntityData(data.Entities, headers); 
                setData(transformedData);
                
                setData(transformedData);
                setRowData(transformedData);
                setHeaders(headers);

            } catch (error) {
                setRowData([]);
                console.log('error: ' + error);
            }
        }

        fetchData();
    }, [EntityName, UserId]);

    useEffect(() => {
        if (data.length > 0 && headers.length > 0 && tableRef.current) {
            const table = $(tableRef.current).DataTable({
                data: data,
                columns: [
                    ...headers.map(header => ({
                        title: header.displayname,
                        data: header.name,
                        type: header.attributetype === 'DateTimeType' ? 'date' : 
                              header.attributetype === 'MoneyType' || header.attributetype === 'IntegerType' ? 'num' : 'string',
                        className: (header.name.toLowerCase().includes('phone') || header.name.toLowerCase().includes('mobile')) ? 'text-right' :
                            header.attributetype === 'StringType' || header.attributetype === 'MemoType' ? 'text-left' :
                                header.attributetype === 'DateTimeType' ? 'date-right' :
                                    header.attributetype === 'MoneyType' || header.attributetype === 'IntegerType' ? 'text-right' : 'text-left'
                    })),
                    { title: 'Edit', data: 'edit', orderable: false, searchable: false, className: 'text-center' } // Add edit button column
                ],
                paging: true,
                searching: false,
                ordering: true,
                destroy: true,
                initComplete: function (settings, json) {
                    const api = (this as any).api();
                    api.columns().every(function (this: any) {
                        let column = this;
                        const title = column.title();
    
                        // Skip the "Edit" column
                        if (column.index() === headers.length) {
                            return;
                        }
    
                        // Create select element
                        let select = document.createElement('select');
                        select.add(new Option(''));
                        $(column.footer()).empty().append(select);
    
                        // Apply listener for user change in value
                        select.addEventListener('change', function () {
                            column.search((select as HTMLSelectElement).value).draw();
                        });
    
                        // Add list of options
                        column.data().unique().sort().each(function (d: string) {
                            // Extract text from the URL
                            let text = $(d).text();
                            if (text === "")
                                text = d;
                            // Format date values to match the format used in the DataTable
                            if (column.type() === 'date') {
                                text = new Date(text).toLocaleDateString();
                            }

                            select.add(new Option(text));
                        });
                    });
                }
            });
    
            return () => {
                table.destroy(); // Clean up on unmount
            };
        }
    }, [data, headers]);

    const handleViewChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedView(event.target.value); 
        _gridData = null;

        const fetchDataForSelectedView = async () => {
            try {
                let viewId: string = '', viewType;
                let headers = [];

                const selectedOption = event.target.options[event.target.selectedIndex];
                viewId = selectedOption.value;
                viewType = selectedOption.dataset.viewtype;

                const vType = viewType ? viewType : '';
                let ename= 'contact';
                let userid= 'c3a65fc0-60a9-ef11-b8e9-00224803cf63';

                const dataResult = await fetchEntityDataRecord(EntityName, viewId, vType, userid, 50, 1, "");

                const fetchedData = JSON.parse(dataResult.entitydata);
                const gridHeader = JSON.parse(dataResult.headerdata);

                if (gridHeader != null) {
                    headers = gridHeader.map((header: { displayname: string; name: string; attributetype: string; optionSetData?: { Label: string; value: number }[] }) => ({
                        displayname: header.displayname,
                        name: header.name,
                        attributetype: header.attributetype,
                        optionSetData: header.optionSetData || null 
                    }));
                }

                if (fetchedData != null && fetchedData.Entities != null && fetchedData.Entities.length > 0) {
                    const transformedData = await transformEntityData(fetchedData.Entities, headers); 
                    setData(transformedData);
                } else {
                    setData([]);
                    setDataKey(prevKey => prevKey + 1); // Force re-render
                }

                setHeaders(headers);

            } catch (error) {
                console.error('Error fetching data for selected view:', error);
            }
        };

        fetchDataForSelectedView();
    };


    const handleFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => { 
        setFilterValue(event.target.value); 
        // Add logic to refresh the grid based on the filter value 
    };
    
    return (
        <>
            <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', width: '100%', alignItems: 'right' }}>
                    <div style={{ width: '50%' }}>
                        <label htmlFor="viewSelect">Select View:</label>
                        &nbsp;
                        <select id="viewSelect" value={selectedView} onChange={handleViewChange} style={{ marginLeft: '5px', width: '350px' }}>
                            {viewList.map((view) => (
                                <option key={view.ViewId} value={view.ViewId} data-viewtype={view.ViewType}>
                                    {view.ViewName}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div style={{ width: '50%', display: 'flex', alignItems: 'right' }}>
                        <label htmlFor="filterInput" style={{ marginLeft: '10px', }}>Filter:</label>&nbsp;
                        <input id="filterInput" type="text" value={filterValue} onChange={handleFilterChange} style={{ marginRight: '5px', marginLeft: '5px', width: '200px' }} />
                    </div>
                </div>
                <div key={dataKey}>
                    <table ref={tableRef} className="display">
                        <thead>
                            <tr>
                                {headers.map((header: any, index: number) => (
                                    <th key={index}>{header.displayname}</th>
                                ))}
                                <th>Edit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* DataTable will populate the tbody */}
                        </tbody>
                        <tfoot>
                            <tr>
                                {headers.map((header: any, index: number) => (
                                    <th key={index}></th>
                                ))}
                                <th></th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </>
    );

});

export default DataTableComponent;