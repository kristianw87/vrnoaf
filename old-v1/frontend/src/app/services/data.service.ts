import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';

import { Observable , of, zip, merge } from 'rxjs';
import { catchError, map, tap , retry, toArray, flatMap, publishReplay, refCount } from 'rxjs/operators';

import { MessageService } from './message.service';
import { environment } from '../../environments/environment';
import { ContentPage } from '../model/json/contentPage';
import { Content } from '../model/json/content';
import { Post } from '../model/post';
import { User } from '../model/json/user';

@Injectable()
export class DataService {

  constructor(
    private messageService: MessageService,
    private httpClient: HttpClient
  ) { }

  getPageContent(pageId: number): Observable<string> {
    const pageContentUrl = environment.wpApiUrl + 'pages/' + pageId;
    return this.httpClient.get<ContentPage>(pageContentUrl)
      .pipe(
          tap(r => this.log('fetched page ' + pageId)),
          catchError(this.handleError('getPage ' + pageId, { content: { rendered: 'Page content not found' } })),
          map(v => v.content.rendered)
        );
  }

  checkNextPageExists(currentPage: number): Observable<boolean> {
    const peekPost = (currentPage * environment.postsPerPage) + 1;
    const request = 'posts?page=' + peekPost + '&per_page=1';
    const postsUrl = environment.wpApiUrl + request;
    return this.httpClient.get<ContentPage[]>(postsUrl)
      .pipe(
          tap(r => this.log('peeked for post ' + peekPost)),
          catchError(this.handleError(request, [])),
          map(r => r.length > 0)
        );
  }

  getPosts(page: number): Observable<Post[]> {
    const postsUrl = environment.wpApiUrl + 'posts?page=' + page + '&per_page=' + environment.postsPerPage;
    return this.httpClient.get<ContentPage[]>(postsUrl)
    .pipe(
        tap(r => this.log(`fetched posts from ${page}`)),
        catchError(this.handleError<ContentPage[]>(postsUrl, [])),
        flatMap(cp => {
          let ids = Array.from(new Set(cp.map(c => c.author)));
          let map = new Map<number, Observable<string>>();
          ids.forEach(v => map.set(v, this.getAuthor(v)));
  
          let authors = merge(...cp.map<Observable<string>>(c => map.get(c.author)));
          return zip(authors, cp, (a, c) => this.createPost(c, a));
        }),
        toArray()
      );
    }

  createPost(cp: ContentPage, author: string) : Post {
    return new Post(cp.content.rendered, cp.title.rendered, new Date(cp.date), author);
  }

  getAuthor(authorId: number): Observable<string> {
    let authorUrl = `${environment.wpApiUrl}users/${authorId}`;
    return this.httpClient.get<User>(authorUrl)
    .pipe(
      tap(r => this.log(`fetched username for user ${authorId}`)),
      catchError(this.handleError<User>(authorUrl, new User())),
      map(u => u.name),
      publishReplay(1),
      refCount()
    );
  }

  /**
 * Handle Http operation that failed.
 * Let the app continue.
 * @param operation - name of the operation that failed
 * @param result - optional value to return as the observable result
 */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {

      this.messageService.error(error);

      this.log(`${operation} failed: ${error.message}`);

      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }

  /** Log a HeroService message with the MessageService */
  private log(message: string) {
    this.messageService.add('DataService: ' + message);
  }

}