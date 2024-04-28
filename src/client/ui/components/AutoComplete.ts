import { LOCAL_STORAGE_HANDLER } from "../../storage/StorageHandler.js";
import { searchUsers } from "../../util/ApiRepository.js";


export class AutoCompleteElement {

  static counter = 0;
  private val: string = "";

  protected rootElement: HTMLFormElement;
  private listElement: HTMLDataListElement;
  
  constructor(onChangeValueCallback: (newVal: string) => void) {
    this.rootElement = document.createElement('form') as HTMLFormElement;
    this.rootElement.className = "user-search";
  
    //while using innerHTML is discouraged due to the potential of XSS attacks,
    //as long as you NEVER supply user-submitted strings into innerHTML, no issues
    //will arise from using it.
    this.rootElement.innerHTML = `
      <input type="text" id="user-search-input${AutoCompleteElement.counter}" list="autocomplete-results${AutoCompleteElement.counter}"/>
      <datalist id="autocomplete-results${AutoCompleteElement.counter}"></datalist>
    `;
  
    //You can retrieve elements in innerHTML using the root element's
    //getElementsByClassName or getElementsByTagName
    this.listElement = this.rootElement.getElementsByTagName('datalist')[0]
    
    
    let input = this.rootElement.getElementsByTagName('input')[0];
    input.oninput = (ev) => {
      this.val = input.value;
      onChangeValueCallback(this.val);
    }

    //used so that multiple instances of Autocomplete can exist on a single page
    AutoCompleteElement.counter++; 
    

    
    //must insert form element into DOM before being able to ask for elements defined
    //in innerHTML using document.getElementById.
  } 

  getValue() {
    return this.val;
  }

  updateChoices(choices: string[]) {
    this.listElement.innerHTML = ""; //clear current list

    let options: HTMLOptionElement[] = [];
    for(let choice of choices) {
      let op = document.createElement('option');
      op.textContent = choice; //use text content to avoid XSS via bad username
      options.push(op);
    }
    this.listElement.append(...options);
  } 

  render(rootElement: HTMLElement) {
    this.rootElement.id = rootElement.id;
    rootElement.replaceWith(this.rootElement);
  }
}


export class UserSearchElement extends AutoCompleteElement {
  constructor(onSubmit: (username: string) => void) {
    super(async (search) => {
      let res = await searchUsers(search);
      this.updateChoices(res.map(u => u.username).filter(u => u !== LOCAL_STORAGE_HANDLER.getUsername()));
    });

    let searchButton = document.createElement('button') as HTMLButtonElement;
    searchButton.onclick = (e) => {
      onSubmit(this.getValue())
    };
    this.rootElement.onsubmit = e => {
      e.preventDefault(); //dont submit the form
    };
    
    searchButton.textContent = "Invite User!";
    this.rootElement.appendChild(searchButton);
  }
}