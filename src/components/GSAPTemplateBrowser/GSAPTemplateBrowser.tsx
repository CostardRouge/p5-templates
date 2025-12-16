"use client";

import React, {
  useEffect, useState
} from "react";
import {
  GSAPTemplateMetadata
} from "@/types/gsap-template.types";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import {
  Input
} from "@/components/ui/input";
import {
  Button
} from "@/components/ui/button";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  Search, Image, Type, Zap, Layers
} from "lucide-react";
import Link from "next/link";

export default function GSAPTemplateBrowser() {
  const [
    templates,
    setTemplates
  ] = useState<GSAPTemplateMetadata[]>( [
  ] );
  const [
    filteredTemplates,
    setFilteredTemplates
  ] = useState<GSAPTemplateMetadata[]>( [
  ] );
  const [
    searchQuery,
    setSearchQuery
  ] = useState( "" );
  const [
    selectedCategory,
    setSelectedCategory
  ] = useState<string>( "all" );
  const [
    loading,
    setLoading
  ] = useState( true );

  // Load templates
  useEffect(
    () => {
      fetch( "/api/templates/gsap" )
        .then( ( res ) => res.json() )
        .then( ( data ) => {
          setTemplates( data.templates );
          setFilteredTemplates( data.templates );
          setLoading( false );
        } )
        .catch( ( err ) => {
          console.error(
            "Failed to load templates:",
            err
          );
          setLoading( false );
        } );
    },
    [
    ]
  );

  // Filter templates
  useEffect(
    () => {
      let filtered = templates;

      // Filter by category
      if ( selectedCategory !== "all" ) {
        filtered = filtered.filter( ( t ) => t.category === selectedCategory );
      }

      // Filter by search query
      if ( searchQuery ) {
        const query = searchQuery.toLowerCase();

        filtered = filtered.filter( ( t ) =>
          t.name.toLowerCase().includes( query ) ||
          t.description.toLowerCase().includes( query ) );
      }

      setFilteredTemplates( filtered );
    },
    [
      templates,
      selectedCategory,
      searchQuery
    ]
  );

  const getCategoryIcon = ( category: string ) => {
    switch ( category ) {
      case "photo":
        return <Image className="h-4 w-4" />;
      case "text":
        return <Type className="h-4 w-4" />;
      case "motion":
        return <Zap className="h-4 w-4" />;
      case "mixed":
        return <Layers className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if ( loading ) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading templates...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">GSAP Templates</h1>
        <p className="text-muted-foreground">
          Professional animation templates powered by GSAP
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={( e ) => setSearchQuery( e.target.value )}
          className="pl-10"
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="photo">Photo</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="motion">Motion</TabsTrigger>
          <TabsTrigger value="mixed">Mixed</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No templates found
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map( ( template ) => (
                <Card key={template.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon( template.category )}
                        <CardTitle>{template.name}</CardTitle>
                      </div>
                    </div>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Thumbnail */}
                      <div className="aspect-[4/5] bg-muted rounded-md overflow-hidden">
                        <img
                          src={template.thumbnail}
                          alt={template.name}
                          className="w-full h-full object-cover"
                          onError={( e: React.SyntheticEvent<HTMLImageElement> ) => {
                            e.currentTarget.src = "/placeholder-template.png";
                          }}
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button asChild className="flex-1">
                          <Link href={`/templates/gsap/${ template.id }`}>
                            Open Template
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
