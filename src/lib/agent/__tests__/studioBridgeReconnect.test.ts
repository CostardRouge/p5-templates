import {
  connectBridge, disconnectBridge, getBridgeStatus
} from "../studioBridge";

/** An EventSource whose events the test fires by hand. */
class FakeEventSource {
  static last: FakeEventSource | null = null;
  onerror: ( () => void ) | null = null;
  onmessage: ( ( event: MessageEvent ) => void ) | null = null;
  closed = false;
  private listeners = new Map<string, ( event: MessageEvent ) => void>();

  constructor( public url: string ) {
    FakeEventSource.last = this;
  }

  addEventListener(
    type: string, listener: ( event: MessageEvent ) => void
  ) {
    this.listeners.set(
      type,
      listener
    );
  }

  fire(
    type: string, data = "{}"
  ) {
    this.listeners.get( type )?.( {
      data
    } as MessageEvent );
  }

  close() {
    this.closed = true;
  }
}

describe(
  "the tab's connection to the relay",
  () => {
    beforeAll( () => {
      Object.assign(
        global,
        {
          EventSource: FakeEventSource,
          sessionStorage: {
            setItem: () => undefined,
            getItem: () => null,
            removeItem: () => undefined
          },
          fetch: () => Promise.resolve( new Response( null ) ),
          // The welcome introduces the tab: its title and route.
          document: {
            title: "Voronoi"
          },
          location: {
            pathname: "/sketches/p5/voronoi/voronoi-v1-cells"
          }
        }
      );
    } );
    afterEach( () => disconnectBridge() );

    it(
      "gives up on a relay that never answered",
      () => {
        connectBridge( 7982 );
        FakeEventSource.last?.onerror?.();
        expect( FakeEventSource.last?.closed ).toBe( true );
        expect( getBridgeStatus().state ).toBe( "error" );
      }
    );

    it(
      "keeps retrying once connected, so a second relay taking the port over is found",
      () => {
        connectBridge( 7982 );

        const events = FakeEventSource.last as FakeEventSource;

        events.fire( "welcome" );
        expect( getBridgeStatus().state ).toBe( "connected" );
        // The hub quits; the browser's first retries fail before a follower
        // has taken the port.
        events.onerror?.();
        events.onerror?.();
        expect( events.closed ).toBe( false );
        expect( getBridgeStatus().state ).toBe( "connecting" );
        // The follower now holds the port and welcomes the retried stream.
        events.fire( "welcome" );
        expect( getBridgeStatus().state ).toBe( "connected" );
      }
    );
  }
);
