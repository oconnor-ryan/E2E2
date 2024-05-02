import { ClientPage } from "../router/ClientPage.js";
import { Page404 } from "../pages/404.js";
import { AccountPage } from "../pages/Account.js";
import { ChatPage } from "../pages/Chat.js";
import { HomePage } from "../pages/Home.js";
import { CallPage } from "../pages/Call.js";



export interface RouterConfig {
  [url: string] : ClientPage;
}


const exampleRouterConfig  = {
  
  '/': new AccountPage(),
  '/home': new HomePage(),
  '/chat': new ChatPage(),
  '/call': new CallPage(),
  '/404': new Page404()
}



class Router {

  private routes: RouterConfig;
  private rootElement: HTMLElement;

  constructor(routes: RouterConfig, rootElement: HTMLElement) {
    this.routes = routes;
    this.rootElement = rootElement;

    //occurs when forward or back buttons are pushed on the browser
    window.addEventListener('popstate', (ev) => {

      //note that if state is empty json, the empty json evaluates to true 
      if(ev.state) {

        //document object may not be updated to new state, so use zero-delay setTimeout
        //callback function to ensure that document is updated.
        //https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event#sect1
        //rerender route
        setTimeout(() => {
          console.log(window.location.pathname);
          this.render(window.location.pathname)
        }, 0);
      }
      

    })
  }

  isRoute(relativeUrl: string) {
    return this.routes.hasOwnProperty(relativeUrl);
  }


  goTo(relativeUrl: string, queryParams?: any) {
    let url = new URL(relativeUrl, window.location.origin);
    url.search = new URLSearchParams(queryParams).toString();

    //change the url
    window.history.pushState({}, "", url);

    //render the page
    this.render(relativeUrl)
  }

  render(relativeUrl: string) {
    if(!this.isRoute(relativeUrl)) {
      this.goTo('/404')
    } else {
      this.routes[relativeUrl].load(this.rootElement);

    }
  }
}

export const ROUTER = new Router(exampleRouterConfig, document.getElementById('root') as HTMLElement);

/*
router.render(window.location.pathname);

const homeButton = document.getElementById('home-button');
const queryButton = document.getElementById('query-button');

homeButton.onclick = (e) => {
  router.goTo('/')
}

queryButton.onclick = (e) => {
  router.goTo('/query', {q: 'hi'})
}
*/