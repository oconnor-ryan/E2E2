/*
  Note that both functions will only keep/remove top level properties in a json
*/

//make a copy of the input json that only contains the properties specified
export function trimJSONKeep<T>(json: any, ...propertiesToKeep: string[]): T {
  let rtn: any = {};

  for(let prop of propertiesToKeep) {
    rtn[prop] = json[prop];
  }

  return rtn as T;

}

//make a copy of the input json that does not include the listed properties
export function trimJSONRemove<T>(json: any, ...propertiesToRemove: string[]): T {
  //make deep copy of json
  let rtn: any = JSON.parse(JSON.stringify(json));

  for(let prop of propertiesToRemove) {
    rtn[prop] = undefined;
  }

  return rtn as T;

}