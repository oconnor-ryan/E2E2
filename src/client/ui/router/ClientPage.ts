export abstract class ClientPage {
  //when writing rendering functions, make them syncronous so that users can quickly see
  //most of the page. 
  //if some elements cannot be rendered syncronously, add a loading bar or something
  //to where the asyncronous element will be inserted once it is finished executing
  abstract load(rootElement: HTMLElement): void;
}
