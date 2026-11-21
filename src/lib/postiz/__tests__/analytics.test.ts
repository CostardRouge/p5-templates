import {
  readAnalytics, readPostAnalytics
} from "../analytics";
import {
  PostizClient, PostizError
} from "../client";

const json = (
  status: number, body: unknown
) => new Response(
  typeof body === "string" ? body : JSON.stringify( body ),
  {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  }
);

// What Postiz's Instagram provider answers for a post (its `postAnalytics`): totals as STRINGS, one point each.
const INSTAGRAM = [
  {
    label: "Views",
    percentageChange: 0,
    data: [
      {
        total: "5120",
        date: "2026-11-20"
      }
    ]
  },
  {
    label: "Reach",
    percentageChange: 0,
    data: [
      {
        total: "4210",
        date: "2026-11-20"
      }
    ]
  }
];

describe(
  "Postiz's analytics answers",
  () => {
    it(
      "reads a post's figures, totals as strings or numbers",
      () => {
        expect( readPostAnalytics( INSTAGRAM ) ).toEqual( {
          kind: "figures",
          series: [
            {
              label: "Views",
              points: [
                {
                  total: 5120,
                  date: "2026-11-20"
                }
              ]
            },
            {
              label: "Reach",
              points: [
                {
                  total: 4210,
                  date: "2026-11-20"
                }
              ]
            }
          ]
        } );
        // An account's daily series carries numbers (Instagram's `analytics`).
        expect( readAnalytics( [
          {
            label: "Follower Count",
            percentageChange: 5,
            data: [
              {
                total: 3,
                date: "2026-11-18"
              },
              {
                total: 0,
                date: "2026-11-19"
              }
            ]
          }
        ] )[ 0 ].points.map( ( p ) => p.total ) ).toEqual( [
          3,
          0
        ] );
      }
    );

    it(
      "tells Postiz's «missing» from an empty answer, and fills nothing",
      () => {
        expect( readPostAnalytics( {
          missing: true
        } ) ).toEqual( {
          kind: "missing"
        } );
        expect( readPostAnalytics( [] ) ).toEqual( {
          kind: "none"
        } );
        expect( readPostAnalytics( null ) ).toEqual( {
          kind: "none"
        } );
        // A label whose total cannot be read is left out — never a zero.
        expect( readAnalytics( [
          {
            label: "Reach",
            data: [
              {
                total: "n/a",
                date: "2026-11-20"
              }
            ]
          },
          {
            label: "",
            data: [
              {
                total: "4",
                date: "2026-11-20"
              }
            ]
          },
          "junk"
        ] ) ).toEqual( [] );
      }
    );

    it(
      "never reads percentageChange: the providers write a constant there",
      () => {
        const read = readAnalytics( [
          {
            label: "Likes",
            percentageChange: 5,
            data: [
              {
                total: "12",
                date: "2026-11-20"
              }
            ]
          }
        ] );

        expect( JSON.stringify( read ) ).not.toContain( "percentage" );
      }
    );

    it(
      "asks the two routes with the key, and says when the route is not there",
      async() => {
        const calls: string[] = [];
        const client = new PostizClient(
          "https://postiz.example/api/public/v1",
          "key",
          async(
            input, init
          ) => {
            calls.push( `${ ( init?.headers as Record<string, string> ).Authorization } ${ input }` );

            if ( input.includes( "/analytics/post/old" ) ) {
              return json(
                404,
                {
                  message: "Cannot GET /public/v1/analytics/post/old"
                }
              );
            }

            return json(
              200,
              INSTAGRAM
            );
          }
        );

        expect( ( await client.postAnalytics( "p 1" ) ).kind ).toBe( "figures" );
        expect( await client.channelAnalytics(
          "ch1",
          30
        ) ).toHaveLength( 2 );
        expect( calls ).toEqual( [
          "key https://postiz.example/api/public/v1/analytics/post/p%201?date=7",
          "key https://postiz.example/api/public/v1/analytics/ch1?date=30"
        ] );
        await expect( client.postAnalytics( "old" ) ).rejects.toMatchObject( {
          status: 404
        } );
        await expect( client.postAnalytics( "old" ) ).rejects.toBeInstanceOf( PostizError );
      }
    );
  }
);
