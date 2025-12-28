using System;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Data.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:postgis", ",,");

            migrationBuilder.CreateTable(
                name: "feeds",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ShortName = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    LongName = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    DownloadUrl = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Etag = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    InsertedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_feeds", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "gtfs_agencies",
                columns: table => new
                {
                    agency_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    feed_id = table.Column<int>(type: "integer", nullable: false),
                    agency_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    agency_url = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    agency_timezone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    agency_lang = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    agency_phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    agency_email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    agency_fare_url = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gtfs_agencies", x => new { x.agency_id, x.feed_id });
                    table.ForeignKey(
                        name: "FK_gtfs_agencies_feeds_feed_id",
                        column: x => x.feed_id,
                        principalTable: "feeds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "gtfs_calendar",
                columns: table => new
                {
                    service_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    feed_id = table.Column<int>(type: "integer", nullable: false),
                    monday = table.Column<bool>(type: "boolean", nullable: false),
                    tuesday = table.Column<bool>(type: "boolean", nullable: false),
                    wednesday = table.Column<bool>(type: "boolean", nullable: false),
                    thursday = table.Column<bool>(type: "boolean", nullable: false),
                    friday = table.Column<bool>(type: "boolean", nullable: false),
                    saturday = table.Column<bool>(type: "boolean", nullable: false),
                    sunday = table.Column<bool>(type: "boolean", nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    end_date = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gtfs_calendar", x => new { x.service_id, x.feed_id });
                    table.ForeignKey(
                        name: "FK_gtfs_calendar_feeds_feed_id",
                        column: x => x.feed_id,
                        principalTable: "feeds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "gtfs_calendar_dates",
                columns: table => new
                {
                    service_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    feed_id = table.Column<int>(type: "integer", nullable: false),
                    exception_type = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gtfs_calendar_dates", x => new { x.service_id, x.date, x.feed_id });
                    table.ForeignKey(
                        name: "FK_gtfs_calendar_dates_feeds_feed_id",
                        column: x => x.feed_id,
                        principalTable: "feeds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "gtfs_stops",
                columns: table => new
                {
                    stop_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    feed_id = table.Column<int>(type: "integer", nullable: false),
                    stop_code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    stop_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    stop_desc = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    stop_pos = table.Column<Point>(type: "geometry", nullable: true),
                    stop_url = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    stop_timezone = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    wheelchair_boarding = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gtfs_stops", x => new { x.stop_id, x.feed_id });
                    table.ForeignKey(
                        name: "FK_gtfs_stops_feeds_feed_id",
                        column: x => x.feed_id,
                        principalTable: "feeds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "gtfs_routes",
                columns: table => new
                {
                    route_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    feed_id = table.Column<int>(type: "integer", nullable: false),
                    agency_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    route_short_name = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    route_long_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    route_desc = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    route_type = table.Column<int>(type: "integer", nullable: false),
                    route_url = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    route_color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    route_text_color = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    route_sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gtfs_routes", x => new { x.route_id, x.feed_id });
                    table.ForeignKey(
                        name: "FK_gtfs_routes_feeds_feed_id",
                        column: x => x.feed_id,
                        principalTable: "feeds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_gtfs_routes_gtfs_agencies_agency_id_feed_id",
                        columns: x => new { x.agency_id, x.feed_id },
                        principalTable: "gtfs_agencies",
                        principalColumns: new[] { "agency_id", "feed_id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "gtfs_trips",
                columns: table => new
                {
                    trip_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    feed_id = table.Column<int>(type: "integer", nullable: false),
                    route_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    service_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    trip_headsign = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    trip_short_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    direction_id = table.Column<int>(type: "integer", nullable: false),
                    block_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    shape_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    trip_wheelchair_accessible = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    trip_bikes_allowed = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gtfs_trips", x => new { x.trip_id, x.feed_id });
                    table.ForeignKey(
                        name: "FK_gtfs_trips_feeds_feed_id",
                        column: x => x.feed_id,
                        principalTable: "feeds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_gtfs_trips_gtfs_routes_route_id_feed_id",
                        columns: x => new { x.route_id, x.feed_id },
                        principalTable: "gtfs_routes",
                        principalColumns: new[] { "route_id", "feed_id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "gtfs_stop_times",
                columns: table => new
                {
                    trip_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    feed_id = table.Column<int>(type: "integer", nullable: false),
                    stop_sequence = table.Column<int>(type: "integer", nullable: false),
                    arrival_time = table.Column<string>(type: "text", nullable: false),
                    departure_time = table.Column<string>(type: "text", nullable: false),
                    stop_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    shape_dist_traveled = table.Column<double>(type: "double precision", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gtfs_stop_times", x => new { x.trip_id, x.stop_sequence, x.feed_id });
                    table.ForeignKey(
                        name: "FK_gtfs_stop_times_feeds_feed_id",
                        column: x => x.feed_id,
                        principalTable: "feeds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_gtfs_stop_times_gtfs_stops_stop_id_feed_id",
                        columns: x => new { x.stop_id, x.feed_id },
                        principalTable: "gtfs_stops",
                        principalColumns: new[] { "stop_id", "feed_id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_gtfs_stop_times_gtfs_trips_trip_id_feed_id",
                        columns: x => new { x.trip_id, x.feed_id },
                        principalTable: "gtfs_trips",
                        principalColumns: new[] { "trip_id", "feed_id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_gtfs_agencies_feed_id",
                table: "gtfs_agencies",
                column: "feed_id");

            migrationBuilder.CreateIndex(
                name: "IX_gtfs_calendar_feed_id",
                table: "gtfs_calendar",
                column: "feed_id");

            migrationBuilder.CreateIndex(
                name: "IX_gtfs_calendar_dates_feed_id",
                table: "gtfs_calendar_dates",
                column: "feed_id");

            migrationBuilder.CreateIndex(
                name: "IX_gtfs_routes_agency_id_feed_id",
                table: "gtfs_routes",
                columns: new[] { "agency_id", "feed_id" });

            migrationBuilder.CreateIndex(
                name: "IX_gtfs_routes_feed_id",
                table: "gtfs_routes",
                column: "feed_id");

            migrationBuilder.CreateIndex(
                name: "IX_gtfs_stop_times_feed_id",
                table: "gtfs_stop_times",
                column: "feed_id");

            migrationBuilder.CreateIndex(
                name: "IX_gtfs_stop_times_stop_id_feed_id",
                table: "gtfs_stop_times",
                columns: new[] { "stop_id", "feed_id" });

            migrationBuilder.CreateIndex(
                name: "IX_gtfs_stop_times_trip_id_feed_id",
                table: "gtfs_stop_times",
                columns: new[] { "trip_id", "feed_id" });

            migrationBuilder.CreateIndex(
                name: "IX_gtfs_stops_feed_id",
                table: "gtfs_stops",
                column: "feed_id");

            migrationBuilder.CreateIndex(
                name: "IX_gtfs_trips_feed_id",
                table: "gtfs_trips",
                column: "feed_id");

            migrationBuilder.CreateIndex(
                name: "IX_gtfs_trips_route_id_feed_id",
                table: "gtfs_trips",
                columns: new[] { "route_id", "feed_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "gtfs_calendar");

            migrationBuilder.DropTable(
                name: "gtfs_calendar_dates");

            migrationBuilder.DropTable(
                name: "gtfs_stop_times");

            migrationBuilder.DropTable(
                name: "gtfs_stops");

            migrationBuilder.DropTable(
                name: "gtfs_trips");

            migrationBuilder.DropTable(
                name: "gtfs_routes");

            migrationBuilder.DropTable(
                name: "gtfs_agencies");

            migrationBuilder.DropTable(
                name: "feeds");
        }
    }
}
