/*jshint esversion: 6 */

const scriptName = "Automation Create Update OTA Programs";  // Now using Processing Cues as part of Core Program Data
const scriptVersion = "22-06-14 v1";
const consoleDebug = false;

output.markdown('# '+ scriptName);
output.markdown('Version '+ scriptVersion);
/*
    This Automation script maintains a table of OTA Programs, where all fields
    are the same as those in the Core Program Data table, but where each row in the 
    Core Program Data table is replicated for EACH of the processing cues defined
    for that Program. If there are no processing cues then OTA Programs table will 
    contain only a single row for the program, but if there is a processing cue then
    there will be two rows. Two processing cues for a Core Program will result in 
    three rows in the OTA Programs table.
*/


const ctlPanel = 'Control Panel';
const automationView = 'Automation View';
const otaTable ='corePrograms Reconciliation';
const broadcastSchedTable = 'Sync Broadcast Schedule';
const coreProgramsTable = 'Core Program Data';

const sourceBoth = "Both";
const sourceGcal = "Google Calendar";
const sourcecorePrograms = "corePrograms";

let reconcileCreateRecords = [];
let reconcileUpdateRecords = [];
/*
let table = base.getTable(ctlPanel);
// Get the control panel record (should be only one)
let controlPanelRecord = await input.recordAsync(
    'Select a record to use',
    table,
);

if (controlPanelRecord) {
} else {
    output.text('No record was selected');
}
const startDate = controlPanelRecord.getCellValue('Starting Date for Reconciliation');
dbMsg ("startDate: " + startDate);

const endDate = controlPanelRecord.getCellValue('Ending Date for Reconciliation');
dbMsg ("endDate: " + endDate);

// Purge old reconciliation records

output.markdown('# Purging old records...');
let oldRecords = await base.getTable(reconcileTable).getView(scriptView).selectRecordsAsync();
let recIDs = [];
for (let record of oldRecords.records) { recIDs.push(record.id); }
while (recIDs.length > 0) {
    dbMsg(recIDs);
    await base.getTable(reconcileTable).deleteRecordsAsync(recIDs.slice(0, 50));
    recIDs = recIDs.slice(50);
} */

// Read the Core Program Data table and the OTA Program Table
let coreProgramsScheduleView = base
    .getTable(coreProgramsTable)
    .getView(automationView);
let coreProgramsQuery = await coreProgramsScheduleView.selectRecordsAsync();
let coreProgramsScheduleRecords = coreProgramsQuery.records;
dbMsg('coreProgramsScheduleRecords', coreProgramsScheduleRecords);

let otaView = base
    .getTable(otaTable)
    .getView(automationView);
let otaQuery = await otaView.selectRecordsAsync();
let otaRecords = otaQuery.records;
dbMsg('otaRecords', otaRecords);

output.markdown('# Adding the corePrograms records...');
for (let coreProgramsRecord of coreProgramsScheduleRecords) {
    reconcileCreateRecords.push({
        fields: {
            'Source': sourcecorePrograms,
            'Broadcast': coreProgramsRecord.getCellValue('corePrograms Show'),
            'Show Start': coreProgramsRecord.getCellValue('corePrograms Show Start'),
            'Duration': coreProgramsRecord.getCellValue('corePrograms Duration'),
            'Control Panel': [controlPanelRecord],
    },
    });
}


// Create the corePrograms records in reconcilation table
while (reconcileCreateRecords.length > 0) {
    await base
        .getTable(otaTable)
        .createRecordsAsync(reconcileCreateRecords.slice(0, 50));
    reconcileCreateRecords = reconcileCreateRecords.slice(50);
}

// Now cycle through the Google Calendar records. We'll either update (for matches) or add new for mismatches
output.markdown('# Reconciling...');

let googleScheduleView = base
    .getTable(broadcastSchedTable)
    .getView(automationView);
let googleScheduleQuery = await googleScheduleView.selectRecordsAsync();
let googleScheduleRecords = googleScheduleQuery.records;
dbMsg('googleScheduleRecords');
dbMsg(googleScheduleRecords);


/*
    Both sets of records are sorted in ascending order by starting date/time.
    For each Google Calendar broadcast search for a matchon Name, start and end.
    Updated the 'Source' field to 'Both' for such matches.

    If the corePrograms Show start is higher than the Google Calendar show start there
    was no match to the Google Calendar entry; add that entry and continue
*/
for (let googleRecord of googleScheduleRecords) {
    if (googleRecord.getCellValue('Public Name').substring(0,2) =="Eco" ) {
        dbMsg('googleRecord Public Name');
        dbMsg(googleRecord.getCellValue('Public Name'));
    }
    dbMsg(googleRecord.getCellValue('Start'));
    dbMsg(googleRecord.getCellValue('End'));
    if (googleRecord.getCellValue('Start') < startDate) {
        continue;
    } 
    if (googleRecord.getCellValue('Start') > endDate) {
            break;
    }

    for (let reconcileRecord of otaRecords) {
        if (
            reconcileRecord.getCellValue('Broadcast') ==
                googleRecord.getCellValue('Public Name') &&
            reconcileRecord.getCellValue('Show Start') ==
                googleRecord.getCellValue('Start') &&
            reconcileRecord.getCellValue('Show End') ==
                googleRecord.getCellValue('End')
        ) {
            dbMsg('Match!', reconcileRecord.getCellValue('Broadcast'));
            reconcileUpdateRecords.push({
                "id": reconcileRecord.id,
                fields: {
                    Source: 'Both',
                },
            });
            break;
        } else {
            if (
                reconcileRecord.getCellValue('Show Start') >
                googleRecord.getCellValue('Start')
            ) {
                dbMsg('Miss', reconcileRecord.getCellValue('Show'));
                reconcileCreateRecords.push({
                    fields: {
                        'Source': 'Google Calendar',
                        'Broadcast': googleRecord.getCellValue('Public Name'),
                        'Show Start': googleRecord.getCellValue('Start'),
                        'Duration': googleRecord.getCellValue('Duration'),
                        'Control Panel': [controlPanelRecord],
                    },
                });
                break;
            }
        }
    }
}

dbMsg('ready to update ... ');
dbMsg("reconcileCreateRecords ", reconcileCreateRecords);
dbMsg("reconcileUpdateRecords ", reconcileUpdateRecords);


// Adding the Google calendar misses
output.markdown('# Adding the Google calendar misses...');
while (reconcileCreateRecords.length > 0) {
    await base
        .getTable(otaTable)
        .createRecordsAsync(reconcileCreateRecords.slice(0, 50));
    reconcileCreateRecords = reconcileCreateRecords.slice(50);
}


// Update the corePrograms records.
output.markdown('# Updating the matches...');
while (reconcileUpdateRecords.length > 0) {
    await base
        .getTable(otaTable)
        .updateRecordsAsync(reconcileUpdateRecords.slice(0, 50));
    reconcileUpdateRecords = reconcileUpdateRecords.slice(50);
}

// Done!
output.markdown('# Reconciliation Complete');

// debugMsg - a conditional wrapper for console.debug messages as a debugging aid.

function dbMsg(a, b = null) {
    if (consoleDebug) {
        if (b==null) {
            console.debug (a);
        } else {
            console.debug (a, b);
        }
    }
  }



// Interface Actions Template 
/*jshint esversion: 6 */

const InterfaceActionsVersion = "22-05-03 v26";

// MegaSeg Easy Automation: Clone an Event Template and all it's detail lines


/*
    Interface Template Configuration - change these fields to to configure for your table/base.
*/
const cloneInThisTable = "Program Template Details";  // The name of the table where you want to be able to clone records.
const cloneUsingThisViewName = "Actions View"; // The view you want this script to use when reading records in the cloneInThisTable table.        
const cloneActionsFieldName = "Actions";    // The field name of the single select field that the user updates to invoke an action.
const cloneString = "Clone";    // String to check for if user wants to clone a record.
const deleteString = "Delete";  // String to check for if user wants to delete a record.
const consoleDebug = true;      // If true the code will generate console.debug messages to aid in troubleshooting.

const cloneTheseFields = [     // List the field names you want copied during a clone action.
    'Program Template',
    'Break Name',
    'Break Start',
    'Sequence',
    'Comment',
    'Included Types'];


/*
    Interface Template Code - leave as is.
*/

// debugMsg - a conditional wrapper for console.debug messages as a debugging aid.

function debugMsg(a, b = null) {
    if (consoleDebug) {
        if (b==null) {
            console.debug (a);
        } else {
            console.debug (a, b);
        }
    }
  }

// prepFieldsObject() populates the fields object to be used in the Airtble create record call  

function prepFieldsObject(recordToClone, theCloneFields) {
    let fieldsObject = {};
    let returnObject = {};
    debugMsg('returnObject:', returnObject);
    
    for (let aField of theCloneFields) {
        fieldsObject[aField] = recordToClone.getCellValue(aField) ;
//        returnObject.fields = recordToClone.getCellValue(aField) ;
        //fieldsObject.push(updateObject);
    }
    return returnObject.fields = Object.assign(fieldsObject);
}


debugMsg('Debugging Interface Actions using ' + InterfaceActionsVersion);

// We expect only one record will be in the view at one time but Murphy's Law says it's not guaranteed.
let actionRecords = await base.getTable(cloneInThisTable).getView(cloneUsingThisViewName).selectRecordsAsync();
debugMsg('clone Records: ', actionRecords);

let  = [];
for (let aRecord of actionRecords.records) {
    debugMsg('cloneRecord: ', aRecord);
    let anAction = aRecord.getCellValue(cloneActionsFieldName).name;
    debugMsg('anAction: ', anAction);
    let myFields = {"Actions": null};

    // Reset the action value in the single select first so errors in the create don't cause an infinite loop.
    await base.getTable(cloneInThisTable).updateRecordAsync(aRecord,{[cloneActionsFieldName]: null});

    if (anAction == cloneString) {
        debugMsg('Cloning the record');
        fieldsObject = prepFieldsObject (aRecord, cloneTheseFields);
        debugMsg('fieldsObject:', fieldsObject);
        await base.getTable(cloneInThisTable).createRecordAsync(fieldsObject);
        debugMsg('done!');
    } else {
        if (anAction == deleteString) {

        debugMsg('Deleting the record');
        await base.getTable(cloneInThisTable).deleteRecordAsync(aRecord.id);
        } else {
            debugMsg('Ignoring the action - it was neither delete or clone');
        }
    }
}


////////////////////////////////////////////////////////////////////////////
//const cloneRecord = await input.recordAsync(inputPrompt, cloneInThisTable);
debugMsg('clone Record', prepFieldsObject);

function prepFieldsObject (recordToClone, theCloneFields, zreturnObject) {
    let fieldsObject = {};
    let returnObject = {};
    debugMsg('returnObject:', returnObject);
    
    for (let aField of theCloneFields) {
        fieldsObject[aField] = recordToClone.getCellValue(aField) ;
//        returnObject.fields = recordToClone.getCellValue(aField) ;
        //fieldsObject.push(updateObject);
    }
    debugMsg('fieldsObject:', fieldsObject);
    return returnObject.fields = Object.assign(fieldsObject);
}

const newRecords =[];
// Clone the Event Template
newRecords.push({
    fields: {
        cloneNameField: prepFieldsObject.getCellValue(cloneNameField)  + " copy",
        cloneFields0 : prepFieldsObject.getCellValue(cloneFields0),
        cloneFields1 : prepFieldsObject.getCellValue(cloneFields0),
        cloneFields2 : prepFieldsObject.getCellValue(cloneFields0),
        cloneFields3 : prepFieldsObject.getCellValue(cloneFields0),
        initFields0 : prepFieldsObject.getCellValue(cloneFields0),
    },
});
debugMsg('new Records:',newRecords);
const newEventRecord = await base.getTable(cloneTable).createRecordsAsync(newRecords);
debugMsg('newEventRecordID',newEventRecord);


// Clone the current Event Template Details line
let table = base.getTable('Event Template Details');
let controlPanelRecord = await input.recordAsync('Select a line to clone', table);
debugMsg('controlPanelRecord', controlPanelRecord);



let zmyobject = {};

let fieldsObj = {};
debugMsg('fieldsObj:',fieldsObj);


const myobject = prepFieldsObject(controlPanelRecord, cloneTheseFields, zmyobject);
debugMsg('myobject:',myobject);
await base.getTable('Event Template Details').createRecordAsync(myobject);
debugMsg('done!');


function prepFieldsObject (recordToClone, theCloneFields, zreturnObject) {
    let fieldsObject = {};
    let returnObject = {};
    debugMsg('returnObject:', returnObject);
    
    for (let aField of theCloneFields) {
        fieldsObject[aField] = recordToClone.getCellValue(aField) ;
//        returnObject.fields = recordToClone.getCellValue(aField) ;
        //fieldsObject.push(updateObject);
    }
    debugMsg('fieldsObject:', fieldsObject);
    return returnObject.fields = Object.assign(fieldsObject);
}



let updatedActionRecords = []; // There should be only 1
updatedActionRecords.push({
    id: logEntry.id,
    fields: {
        cloneActionsFieldName: "",
    },
  });

    // Update the new program log table with content placements
    infoMsg("Updating Program Log table with content placements");
    while (updatedActionRecords.length > 0) {
      await base
        .getTable("Program Log")
        .updateRecordsAsync(updatedActionRecords.slice(0, 50));
      updatedActionRecords = updatedActionRecords.slice(50);
    }
    output.markdown("# Generation complete");

const cloneNameField = "Break Name";
const cloneLinkedRecordsField = "x";
const cloneFields0 = "Break Start";
const cloneFields1 = "Included Types";
const cloneFields2 = "Max Duration";
const inputPrompt = 'Select a record to clone'

