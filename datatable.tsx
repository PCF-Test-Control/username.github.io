/* eslint-disable */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import "datatables.net-dt/css/dataTables.dataTables.css"; // DataTables styles
import $ from "jquery"; 
import "datatables.net-dt";
import { DataService } from './dataService'; 

import '../css/DataGridMain.css'; // Import the CSS file

//TODO: Remove these after testing
let _gridData : any;

interface DataTableProps {
    EntityName: string;
    UserId: string;
}

const DataTableComponent: React.FC<DataTableProps> = React.memo(({ EntityName, UserId }) => {
    const tableRef = React.useRef<HTMLTableElement>(null);
    const tableBodyRef = useRef<HTMLTableSectionElement>(null);

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
                let dataResultForView = await DataService.fetchViewData(ename , userid);

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
                const dataResult = await DataService.fetchEntityDataRecord(EntityName, viewId, viewType, userid, 50, 1, "");
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
                const transformedData = await DataService.transformEntityData(data.Entities, headers); 
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
                        const type = column.type();

                        // Skip the "Edit" column
                        if (column.index() === headers.length || type === 'num' || 
                            title === 'Credit Hold' || title === 'Description' || title === 'Marital Status' ||
                            title === 'Address 1: Address Type' || title === 'Access Failed Count' || title === 'Calculated Column'
                            || title === 'Currency')   {
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


    useEffect(() => {
        // Clear table rows when data is empty
        if (data.length === 0 && tableBodyRef.current) {
            tableBodyRef.current.innerHTML = 'No Data found'; // Clear table rows directly
        }
    }, [data]);

    const handleViewChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedView(event.target.value); 
        _gridData = null;

        try {
            let viewId: string = '', viewType;
            let headers = [];
    
            const selectedOption = event.target.options[event.target.selectedIndex];
            viewId = selectedOption.value;
            viewType = selectedOption.dataset.viewtype;
    
            const vType = viewType ? viewType : '';
            let ename = 'contact';
            let userid = 'c3a65fc0-60a9-ef11-b8e9-00224803cf63';
    
            const dataResult = await DataService.fetchEntityDataRecord(EntityName, viewId, vType, userid, 50, 1, "");
    
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
            
            setHeaders(headers);

            if (fetchedData != null && fetchedData.Entities != null && fetchedData.Entities.length > 0) {
                const transformedData = await DataService.transformEntityData(fetchedData.Entities, headers);
                setData(transformedData);
            } else {
                setData([]); // Clear the data
            }
        } catch (error) {
            console.error('Error fetching data for selected view:', error);
        }
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
                        <tbody ref={tableBodyRef}>
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
